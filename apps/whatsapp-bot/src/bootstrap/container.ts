import type { WhatsAppTransport } from "@bot-whatsapp/whatsapp";
import { getConfig } from "../config";
import type { Config } from "../config/schema";
import { log } from "../lib/logging/logger";
import { RedisClient } from "../infrastructure/database/redis";
import { PostgresClient } from "../infrastructure/database/postgres";
import { UserRepository } from "../infrastructure/database/repositories/user-repository";
import { GroupRepository } from "../infrastructure/database/repositories/group-repository";
import { CacheRepository } from "../infrastructure/database/repositories/cache-repository";
import { JobQueues } from "../infrastructure/queue/job-queues";
import { stickerJob } from "../infrastructure/queue/jobs/sticker-job";
import { spotifyJob } from "../infrastructure/queue/jobs/spotify-job";
import { docsJob } from "../infrastructure/queue/jobs/docs-job";
import { withRetry } from "../lib/resilience/with-retry";
import { TempFileStore } from "../infrastructure/storage/temp-file-store";
import { SpotifyClient } from "../infrastructure/external/spotify-client";
import { AnnasArchiveClient } from "../infrastructure/external/annas-archive-client";
import { ImgurClient } from "../infrastructure/external/imgur-client";
import { DigImageEffects } from "../infrastructure/images/dig-image-effects";
import { FfmpegConverter } from "../infrastructure/media/ffmpeg-converter";
import { PollyTextToSpeech } from "../infrastructure/speech/polly-text-to-speech";
import { TypstLatexRenderer } from "../infrastructure/latex/typst-latex-renderer";
import type { CommandDeps } from "../application/command-deps";
import { createCommands } from "../application/commands";
import { UserService } from "../application/services/user-service";
import { PermissionChecker } from "../application/services/permission-checker";
import { CommandExecutor } from "../application/services/command-executor";
import { MessageProcessor } from "../application/handlers/message-handler";
import { ErrorHandler } from "../application/handlers/error-handler";
import { OwnerNotifier } from "../application/services/owner-notifier";
import { ResponseBuilder } from "../presentation/response-builder";
import { Acknowledgment } from "../presentation/acknowledgment";

export interface Container {
  redis: RedisClient;
  jobQueues: JobQueues;
  transport: WhatsAppTransport;
  annasClient: AnnasArchiveClient;
  messageProcessor: MessageProcessor;
  commandPrefix: string;
}

// The only place that names a WhatsApp library: swapping WHATSAPP_TRANSPORT
// swaps the adapter package, nothing else in the app.
async function createTransport(config: Config): Promise<WhatsAppTransport> {
  switch (config.WHATSAPP_TRANSPORT) {
    case "wwebjs": {
      const { createWwebjsTransport } =
        await import("@bot-whatsapp/whatsapp-wwebjs");
      return createWwebjsTransport({
        chromePath: config.CHROME_PATH,
        logger: log,
      });
    }
    case "baileys": {
      const { createBaileysTransport } =
        await import("@bot-whatsapp/whatsapp-baileys");
      return createBaileysTransport({
        logger: log,
      });
    }
  }
}

export async function buildContainer(): Promise<Container> {
  const config = getConfig();

  const redis = new RedisClient(config.REDIS_HOST, config.REDIS_PORT);
  const postgres = new PostgresClient(config.SUPABASE_URL, config.SUPABASE_KEY);

  // Not connected yet: lifecycle.ts connects only after onMessage is
  // registered, so no message can arrive before anything is listening.
  const transport = await createTransport(config);
  // BullMQ retries job attempts; direct command replies use withRetry instead.
  const jobSender = transport;
  const sender = withRetry(transport);
  const tempFiles = new TempFileStore();
  await tempFiles.initialize();

  const users = new UserRepository(postgres);
  const groups = new GroupRepository(postgres);
  const userService = new UserService(users, config.OWNER_PHONE);

  const spotify = new SpotifyClient(
    config.SPOTIFY_CLIENT_ID,
    config.SPOTIFY_CLIENT_SECRET
  );
  const annasClient = new AnnasArchiveClient(config.CHROME_PATH);

  const ownerNotifier = new OwnerNotifier(sender, config.OWNER_PHONE);
  const executor = new CommandExecutor(
    userService,
    new PermissionChecker(config.OWNER_PHONE),
    groups,
    ownerNotifier,
    config.COMMAND_PREFIX
  );

  const jobQueues = new JobQueues(
    { host: config.REDIS_HOST, port: config.REDIS_PORT },
    {
      sticker: stickerJob({ sender: jobSender, tempFiles }),
      spotify: spotifyJob({ spotify, sender: jobSender, tempFiles }),
      docs: docsJob({ annas: annasClient, sender: jobSender, tempFiles }),
    },
    sender
  );

  const deps: CommandDeps = {
    sender,
    groups,
    users,
    userService,
    tempFiles,
    searchCache: new CacheRepository(redis),
    jobs: jobQueues,
    books: annasClient,
    tracks: spotify,
    imageHost: new ImgurClient(config.IMGUR_CLIENT_ID),
    effects: new DigImageEffects(),
    converter: new FfmpegConverter(),
    speech: new PollyTextToSpeech(
      {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
        region: config.AWS_REGION,
      },
      tempFiles
    ),
    latex: new TypstLatexRenderer(),
    executor,
  };
  for (const command of createCommands(deps)) {
    executor.registerCommand(command);
  }

  const responseBuilder = new ResponseBuilder(sender, tempFiles);
  const messageProcessor = new MessageProcessor(
    executor,
    responseBuilder,
    new Acknowledgment(sender),
    new ErrorHandler(responseBuilder, ownerNotifier)
  );

  return {
    redis,
    jobQueues,
    transport,
    annasClient,
    messageProcessor,
    commandPrefix: config.COMMAND_PREFIX,
  };
}
