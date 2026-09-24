import { getConfig } from "../config";
import { RedisClient } from "../infrastructure/database/redis";
import { PostgresClient } from "../infrastructure/database/postgres";
import { UserRepository } from "../infrastructure/database/repositories/user-repository";
import { GroupRepository } from "../infrastructure/database/repositories/group-repository";
import { CacheRepository } from "../infrastructure/database/repositories/cache-repository";
import { JobQueues } from "../infrastructure/queue/job-queues";
import { stickerJob } from "../infrastructure/queue/jobs/sticker-job";
import { spotifyJob } from "../infrastructure/queue/jobs/spotify-job";
import { docsJob } from "../infrastructure/queue/jobs/docs-job";
import { WhatsAppClient } from "../infrastructure/whatsapp/client";
import { WhatsAppReceiver } from "../infrastructure/whatsapp/receiver";
import {
  RetryingWhatsAppSender,
  WhatsAppSender,
} from "../infrastructure/whatsapp/sender";
import { TempFileStore } from "../infrastructure/storage/temp-file-store";
import { SpotifyClient } from "../infrastructure/external/spotify-client";
import { AnnasArchiveClient } from "../infrastructure/external/annas-archive-client";
import { ImgurClient } from "../infrastructure/external/imgur-client";
import { DigImageEffects } from "../infrastructure/images/dig-image-effects";
import { FfmpegConverter } from "../infrastructure/media/ffmpeg-converter";
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
  whatsappClient: WhatsAppClient;
  whatsappReceiver: WhatsAppReceiver;
  annasClient: AnnasArchiveClient;
  messageProcessor: MessageProcessor;
}

export async function buildContainer(): Promise<Container> {
  const config = getConfig();

  const redis = new RedisClient(config.REDIS_HOST, config.REDIS_PORT);
  const postgres = new PostgresClient(config.SUPABASE_URL, config.SUPABASE_KEY);

  const whatsappClient = new WhatsAppClient(config.CHROME_PATH);
  await whatsappClient.initialize();

  const whatsappReceiver = new WhatsAppReceiver(
    whatsappClient.getClient(),
    config.COMMAND_PREFIX
  );
  // BullMQ retries job attempts; direct command replies use RetryingWhatsAppSender.
  const jobSender = new WhatsAppSender(whatsappClient.getClient());
  const sender = new RetryingWhatsAppSender(whatsappClient.getClient());
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
    whatsappClient,
    whatsappReceiver,
    annasClient,
    messageProcessor,
  };
}
