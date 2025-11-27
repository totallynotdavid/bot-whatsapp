import { AddPremiumCommand } from "./application/commands/admin/add-premium.command";
import { KickCommand } from "./application/commands/admin/kick.command";
import { CommandRegistry } from "./application/commands/command.registry";
import { HelpCommand } from "./application/commands/general/help.command";
import { PingCommand } from "./application/commands/general/ping.command";
import { StickerCommand } from "./application/commands/media/sticker.command";
import { ProcessMessageUseCase } from "./application/use-cases/process-message.use-case";
import { loadConfig } from "./config/env.config";
import { validateEnvironment } from "./config/env.validator";
import { PermissionService } from "./domain/services/permission.service";
import { StateManager } from "./domain/services/state-manager.service";
import { PhoneNumber } from "./domain/value-objects/phone-number";
import { RedisService } from "./infrastructure/cache/redis.service";
import { SupabaseService } from "./infrastructure/database/supabase.client";
import { UserRepository } from "./infrastructure/database/user.repository";
import { FileManager } from "./infrastructure/file-system/file.manager";
import { QueueService } from "./infrastructure/queue/queue.service";
import { WhatsAppAdapter } from "./infrastructure/whatsapp/whatsapp.adapter";
import { WhatsAppClient } from "./infrastructure/whatsapp/whatsapp.client";
import { logger } from "./shared/logger";
import { mediaWorkerProcessor } from "./workers/media.worker";

async function bootstrap() {
  logger.info("Starting bot...");

  const config = loadConfig();
  await validateEnvironment(config);

  await FileManager.initialize();

  // Infrastructure
  const cache = new RedisService(config.REDIS_HOST, config.REDIS_PORT);
  const database = new SupabaseService(
    config.SUPABASE_URL,
    config.SUPABASE_KEY
  );
  const ownerPhone = PhoneNumber.create(config.OWNER_PHONE);
  const userRepo = new UserRepository(database, ownerPhone);
  const whatsappClient = new WhatsAppClient();
  const queue = new QueueService(config.REDIS_HOST, config.REDIS_PORT);

  // Domain services
  const permissions = new PermissionService(
    cache,
    ownerPhone,
    config.CACHE_TTL_SECONDS
  );
  const stateManager = new StateManager(userRepo, cache, 60000);
  await stateManager.initialize();

  // Application
  const registry = new CommandRegistry();

  registry.register(new PingCommand());
  registry.register(new HelpCommand(registry));
  registry.register(new KickCommand());
  registry.register(new AddPremiumCommand());
  registry.register(new StickerCommand());

  logger.info("Commands registered", {
    count: registry.getAllCommands().length,
    commands: registry.getAllCommands().map((c) => c.metadata.name),
  });

  const services = {
    userRepository: userRepo,
    queueService: queue,
    whatsappClient,
    ownerPhone,
  };

  const processMessage = new ProcessMessageUseCase(
    registry,
    permissions,
    services,
    config.COMMAND_PREFIX
  );

  queue.startWorker(async (job) => {
    return await mediaWorkerProcessor(
      job,
      whatsappClient.downloadMedia.bind(whatsappClient)
    );
  });

  queue.onCompleted(async (job, result) => {
    if (result.success && result.outputPath) {
      await whatsappClient.sendMedia(
        job.data.chatId,
        result.outputPath,
        result.caption,
        job.data.messageId
      );
      await FileManager.cleanup(result.outputPath);
    } else {
      await whatsappClient.sendText(
        job.data.chatId,
        `❌ Error: ${result.error}`,
        job.data.messageId
      );
    }
  });

  const adapter = new WhatsAppAdapter(whatsappClient, stateManager);
  await adapter.start((msg) => processMessage.execute(msg));

  logger.info("Bot started successfully");

  const shutdown = async () => {
    logger.info("Shutting down...");
    await cache.close();
    await queue.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((err) => {
  logger.error("Fatal error during startup", err);
  process.exit(1);
});
