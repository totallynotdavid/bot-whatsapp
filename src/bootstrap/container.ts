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
import { UserService } from "../application/services/user-service";
import { PermissionChecker } from "../application/services/permission-checker";
import { CommandExecutor } from "../application/services/command-executor";
import type { JobScheduler } from "../application/services/job-scheduler";
import { MessageProcessor } from "../application/handlers/message-handler";
import { ErrorHandler } from "../application/handlers/error-handler";
import { ResponseBuilder } from "../presentation/response-builder";
import { Acknowledgment } from "../presentation/acknowledgment";
import { HelpCommand } from "../application/commands/help-command";
import { StickerCommand } from "../application/commands/sticker-command";
import { KickCommand } from "../application/commands/kick-command";
import { PremiumCommand } from "../application/commands/premium-command";
import { AddGroupCommand } from "../application/commands/addgroup-command";
import { BotCommand } from "../application/commands/bot-command";
import { SubscriptionCommand } from "../application/commands/subscription-command";
import { RefreshCommand } from "../application/commands/refresh-command";
import { GlobalCommand } from "../application/commands/global-command";
import { SpotifyCommand } from "../application/commands/spotify-command";
import { DocsCommand } from "../application/commands/docs-command";
import { EditCommand } from "../application/commands/edit-command";
import { SpotifyClient } from "../infrastructure/external/spotify-client";
import { AnnasArchiveClient } from "../infrastructure/external/annas-archive-client";
import { ImgurClient } from "../infrastructure/external/imgur-client";

export interface Container {
  redis: RedisClient;
  postgres: PostgresClient;
  jobQueues: JobQueues;
  whatsappClient: WhatsAppClient;
  whatsappReceiver: WhatsAppReceiver;
  whatsappSender: WhatsAppSender;
  tempFileStore: TempFileStore;
  userRepo: UserRepository;
  groupRepo: GroupRepository;
  cacheRepo: CacheRepository;
  spotifyClient: SpotifyClient;
  annasClient: AnnasArchiveClient;
  imgurClient: ImgurClient;
  userService: UserService;
  permissionChecker: PermissionChecker;
  commandExecutor: CommandExecutor;
  responseBuilder: ResponseBuilder;
  acknowledgment: Acknowledgment;
  errorHandler: ErrorHandler;
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
  const whatsappSender = new RetryingWhatsAppSender(whatsappClient.getClient());
  const tempFileStore = new TempFileStore();
  await tempFileStore.initialize();

  const userRepo = new UserRepository(postgres);
  const groupRepo = new GroupRepository(postgres);
  const cacheRepo = new CacheRepository(redis);

  const spotifyClient = new SpotifyClient(
    config.SPOTIFY_CLIENT_ID,
    config.SPOTIFY_CLIENT_SECRET
  );
  const annasClient = new AnnasArchiveClient(config.CHROME_PATH);
  const imgurClient = new ImgurClient(config.IMGUR_CLIENT_ID);

  const permissionChecker = new PermissionChecker(config.OWNER_PHONE);
  const userService = new UserService(userRepo, config.OWNER_PHONE);

  const commandExecutor = new CommandExecutor(
    userService,
    permissionChecker,
    groupRepo,
    config.COMMAND_PREFIX
  );

  const jobQueues = new JobQueues(
    { host: config.REDIS_HOST, port: config.REDIS_PORT },
    {
      sticker: stickerJob({ sender: jobSender, tempFiles: tempFileStore }),
      spotify: spotifyJob({
        spotify: spotifyClient,
        sender: jobSender,
        tempFiles: tempFileStore,
      }),
      docs: docsJob({
        annas: annasClient,
        sender: jobSender,
        tempFiles: tempFileStore,
      }),
    },
    whatsappSender
  );

  const responseBuilder = new ResponseBuilder(whatsappSender, tempFileStore);
  const acknowledgment = new Acknowledgment(whatsappSender);
  const errorHandler = new ErrorHandler(responseBuilder, config.OWNER_PHONE);

  const messageProcessor = new MessageProcessor(
    commandExecutor,
    responseBuilder,
    acknowledgment,
    errorHandler
  );

  registerCommands(
    commandExecutor,
    jobQueues,
    whatsappSender,
    userService,
    userRepo,
    groupRepo,
    cacheRepo,
    spotifyClient,
    annasClient,
    imgurClient,
    tempFileStore
  );

  return {
    redis,
    postgres,
    jobQueues,
    whatsappClient,
    whatsappReceiver,
    whatsappSender,
    tempFileStore,
    userRepo,
    groupRepo,
    cacheRepo,
    spotifyClient,
    annasClient,
    imgurClient,
    userService,
    permissionChecker,
    commandExecutor,
    responseBuilder,
    acknowledgment,
    errorHandler,
    messageProcessor,
  };
}

function registerCommands(
  executor: CommandExecutor,
  jobScheduler: JobScheduler,
  sender: WhatsAppSender,
  userService: UserService,
  userRepo: UserRepository,
  groupRepo: GroupRepository,
  cacheRepo: CacheRepository,
  spotifyClient: SpotifyClient,
  annasClient: AnnasArchiveClient,
  imgurClient: ImgurClient,
  tempFileStore: TempFileStore
): void {
  executor.registerCommand(new HelpCommand(executor));
  executor.registerCommand(new StickerCommand(jobScheduler, sender));
  executor.registerCommand(new KickCommand(sender));
  executor.registerCommand(new PremiumCommand(userService));
  executor.registerCommand(new SpotifyCommand(jobScheduler, spotifyClient));
  executor.registerCommand(
    new DocsCommand(annasClient, cacheRepo, jobScheduler)
  );
  executor.registerCommand(new AddGroupCommand(groupRepo));
  executor.registerCommand(new BotCommand(groupRepo));
  executor.registerCommand(new SubscriptionCommand(groupRepo));
  executor.registerCommand(new RefreshCommand(userService));
  executor.registerCommand(new GlobalCommand(userRepo, sender));
  executor.registerCommand(new EditCommand(sender, imgurClient, tempFileStore));
}
