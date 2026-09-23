import { getConfig } from "../config";
import { RedisClient } from "../infrastructure/database/redis";
import { PostgresClient } from "../infrastructure/database/postgres";
import { UserRepository } from "../infrastructure/database/repositories/user-repository";
import { GroupRepository } from "../infrastructure/database/repositories/group-repository";
import { CacheRepository } from "../infrastructure/database/repositories/cache-repository";
import { QueueClient } from "../infrastructure/queue/client";
import { WhatsAppClient } from "../infrastructure/whatsapp/client";
import { WhatsAppReceiver } from "../infrastructure/whatsapp/receiver";
import { WhatsAppSender } from "../infrastructure/whatsapp/sender";
import { TempFileStore } from "../infrastructure/storage/temp-file-store";
import { UserService } from "../application/services/user-service";
import { PermissionChecker } from "../application/services/permission-checker";
import { CommandExecutor } from "../application/services/command-executor";
import { JobScheduler } from "../application/services/job-scheduler";
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
import { SpotifyCommand } from "../application/commands/spotify-command";
import { DocsCommand } from "../application/commands/docs-command";
import { SpotifyClient } from "../infrastructure/external/spotify-client";
import { AnnasArchiveClient } from "../infrastructure/external/annas-archive-client";
import { StickerProcessor } from "../infrastructure/queue/processors/sticker-processor";
import { SpotifyProcessor } from "../infrastructure/queue/processors/spotify-processor";
import { DocsProcessor } from "../infrastructure/queue/processors/docs-processor";
import { JobHandler } from "../application/handlers/job-handler";

export interface Container {
  redis: RedisClient;
  postgres: PostgresClient;
  queue: QueueClient;
  whatsappClient: WhatsAppClient;
  whatsappReceiver: WhatsAppReceiver;
  whatsappSender: WhatsAppSender;
  tempFileStore: TempFileStore;
  userRepo: UserRepository;
  groupRepo: GroupRepository;
  cacheRepo: CacheRepository;
  spotifyClient: SpotifyClient;
  annasClient: AnnasArchiveClient;
  userService: UserService;
  permissionChecker: PermissionChecker;
  commandExecutor: CommandExecutor;
  jobScheduler: JobScheduler;
  jobHandler: JobHandler;
  responseBuilder: ResponseBuilder;
  acknowledgment: Acknowledgment;
  errorHandler: ErrorHandler;
  messageProcessor: MessageProcessor;
}

export async function buildContainer(): Promise<Container> {
  const config = getConfig();

  const redis = new RedisClient(config.REDIS_HOST, config.REDIS_PORT);
  const postgres = new PostgresClient(config.SUPABASE_URL, config.SUPABASE_KEY);
  const queue = new QueueClient(config.REDIS_HOST, config.REDIS_PORT);

  const whatsappClient = new WhatsAppClient(config.CHROME_PATH);
  await whatsappClient.initialize();

  const whatsappReceiver = new WhatsAppReceiver(whatsappClient.getClient());
  const whatsappSender = new WhatsAppSender(whatsappClient.getClient());
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

  const permissionChecker = new PermissionChecker(
    cacheRepo,
    config.OWNER_PHONE
  );
  const userService = new UserService(
    userRepo,
    permissionChecker,
    config.OWNER_PHONE
  );

  const commandExecutor = new CommandExecutor(
    userService,
    permissionChecker,
    groupRepo,
    config.COMMAND_PREFIX
  );

  const jobScheduler = new JobScheduler(queue);

  const stickerProcessor = new StickerProcessor(whatsappSender, tempFileStore);
  const spotifyProcessor = new SpotifyProcessor(spotifyClient, tempFileStore);
  const docsProcessor = new DocsProcessor(annasClient, tempFileStore);

  const jobHandler = new JobHandler(
    stickerProcessor,
    spotifyProcessor,
    docsProcessor,
    whatsappSender,
    tempFileStore
  );

  const responseBuilder = new ResponseBuilder(whatsappSender);
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
    jobScheduler,
    whatsappSender,
    userService,
    groupRepo,
    cacheRepo,
    annasClient
  );

  return {
    redis,
    postgres,
    queue,
    whatsappClient,
    whatsappReceiver,
    whatsappSender,
    tempFileStore,
    userRepo,
    groupRepo,
    cacheRepo,
    spotifyClient,
    annasClient,
    userService,
    permissionChecker,
    commandExecutor,
    jobScheduler,
    jobHandler,
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
  groupRepo: GroupRepository,
  cacheRepo: CacheRepository,
  annasClient: AnnasArchiveClient
): void {
  executor.registerCommand(new HelpCommand(executor));
  executor.registerCommand(new StickerCommand(jobScheduler, sender));
  executor.registerCommand(new KickCommand(sender));
  executor.registerCommand(new PremiumCommand(userService));
  executor.registerCommand(new SpotifyCommand(jobScheduler));
  executor.registerCommand(
    new DocsCommand(annasClient, cacheRepo, jobScheduler)
  );
  executor.registerCommand(new AddGroupCommand(groupRepo));
  executor.registerCommand(new BotCommand(groupRepo));
  executor.registerCommand(new SubscriptionCommand(groupRepo));
  executor.registerCommand(new RefreshCommand(cacheRepo, userService));
}
