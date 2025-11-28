import { Client, LocalAuth } from "whatsapp-web.js";
import { config } from "./config";
import { log } from "./lib/logger";
import { Monitor } from "./lib/monitor";

import { MediaStore } from "./stores/media-store";
import { UserStore } from "./stores/user-store";
import { PermissionStore } from "./stores/permission-store";

import { RedisAdapter } from "./adapters/redis-adapter";
import { PostgresAdapter } from "./adapters/postgres-adapter";
import { QueueAdapter } from "./adapters/queue-adapter";
import { WhatsAppReceiver } from "./adapters/whatsapp-receiver";
import { WhatsAppSender } from "./adapters/whatsapp-sender";

import { StateManager } from "./core/state-manager";
import { PermissionGuard } from "./core/permission-guard";
import { ResponseWriter } from "./core/response-writer";
import { MessageHandler } from "./core/message-handler";

import { buildCommandRegistry } from "./commands/registry";
import { AnnasSearchAdapter } from "./adapters/annas-search-adapter";
import { AnnasDownloadAdapter } from "./adapters/annas-download-adapter";
import { SearchStore } from "./stores/search-store";
import { MediaWorker } from "./workers/media-worker";

async function bootstrap(): Promise<void> {
  log("info", "Bot starting", { environment: config.NODE_ENV });

  const monitor = new Monitor();
  monitor.start();

  await MediaStore.initialize();

  const { redis, postgres, queue, searchStore, annasSearchAdapter, annasDownloadAdapter } = await initializeServices();

  const whatsappClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
      executablePath: config.CHROME_PATH,
    },
  });

  setupWhatsAppClientEvents(whatsappClient);

  const receiver = new WhatsAppReceiver(whatsappClient);
  const sender = new WhatsAppSender(whatsappClient);

  const userStore = new UserStore(postgres, config.OWNER_PHONE);
  const permissionStore = new PermissionStore(redis);

  const stateManager = new StateManager(
    userStore,
    permissionStore,
    config.OWNER_PHONE
  );
  const permissionGuard = new PermissionGuard(
    permissionStore,
    config.OWNER_PHONE
  );
  const responseWriter = new ResponseWriter(sender);

  const commandDependencies = {
    userStore,
    queueAdapter: queue,
    sender,
    ownerPhone: config.OWNER_PHONE,
  };

  await receiver.initialize();
  receiver.onMessage(async (message) => {
    await messageHandler.handleMessage(message);
  });

  const updatedCommandDependencies = {
    ...commandDependencies,
    annasSearchAdapter,
    searchStore,
  };

  const commandRouter = buildCommandRegistry(updatedCommandDependencies);

  const messageHandler = new MessageHandler(
    commandRouter,
    permissionGuard,
    stateManager,
    responseWriter,
    sender,
    config.COMMAND_PREFIX
  );

  const mediaWorker = new MediaWorker(queue, sender, annasDownloadAdapter);
  mediaWorker.start();

  await stateManager.refreshStats();
  startPeriodicStatsRefresh(stateManager);

  log("info", "Bot started successfully", {
    ownerPhone: config.OWNER_PHONE,
    commandPrefix: config.COMMAND_PREFIX,
  });

  setupGracefulShutdown(monitor, redis, queue, userStore, annasDownloadAdapter);
}

async function initializeServices(): Promise<{
  redis: RedisAdapter;
  postgres: PostgresAdapter;
  queue: QueueAdapter;
  searchStore: SearchStore;
  annasSearchAdapter: AnnasSearchAdapter;
  annasDownloadAdapter: AnnasDownloadAdapter;
}> {
  const redis = new RedisAdapter(config.REDIS_HOST, config.REDIS_PORT);
  const postgres = new PostgresAdapter(
    config.SUPABASE_URL,
    config.SUPABASE_KEY
  );
  const queue = new QueueAdapter(config.REDIS_HOST, config.REDIS_PORT);

  const searchStore = new SearchStore(redis);
  const annasSearchAdapter = new AnnasSearchAdapter();
  const annasDownloadAdapter = new AnnasDownloadAdapter();

  return {
    redis,
    postgres,
    queue,
    searchStore,
    annasSearchAdapter,
    annasDownloadAdapter,
  };
}

function setupWhatsAppClientEvents(client: Client): void {
  client.on("qr", () => {
    log("info", "QR code generated. Scan with WhatsApp");
  });

  client.on("ready", () => {
    log("info", "WhatsApp client ready");
  });

  client.on("auth_failure", (message) => {
    log("error", "WhatsApp authentication failed", { message });
  });

  client.on("disconnected", (reason) => {
    log("error", "WhatsApp client disconnected", { reason });
  });
}

function startPeriodicStatsRefresh(stateManager: StateManager): void {
  setInterval(() => {
    stateManager.refreshStats().catch((error) => {
      log("error", "Periodic stats refresh failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, 60000);
}

function setupGracefulShutdown(
  monitor: Monitor,
  redis: RedisAdapter,
  queue: QueueAdapter,
  userStore: UserStore,
  annasDownloadAdapter: AnnasDownloadAdapter
): void {
  const shutdown = async (): Promise<void> => {
    log("info", "Shutting down gracefully");

    monitor.stop();
    userStore.stopSync();

    await redis.close();
    await queue.close();
    await annasDownloadAdapter.close();

    log("info", "Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  log("error", "Fatal startup error", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
