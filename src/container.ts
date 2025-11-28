import type { Environment } from "./config/environment";
import { PhoneNumber } from "./domain/value-objects/phone-number.vo";

import { MessageReceiver } from "./infrastructure/whatsapp/message-receiver";
import { MessageSender } from "./infrastructure/whatsapp/message-sender";
import { MediaValidator } from "./infrastructure/whatsapp/media-validator";
import { WhatsAppClientFactory } from "./infrastructure/whatsapp/whatsapp-client-factory";

import { LocalUserRepository } from "./infrastructure/persistence/local/local-user-repository";
import { PostgresUserRepository } from "./infrastructure/persistence/postgres/user-repository.impl";
import { PostgresClient } from "./infrastructure/persistence/postgres/postgres-client";
import { RedisClient } from "./infrastructure/persistence/cache/redis-client";

import { QueueClient } from "./infrastructure/queue/queue-client";
import { MediaProcessor } from "./infrastructure/queue/media-processor";

import { RetryPolicy } from "./infrastructure/resilience/retry-policy";
import { TimeoutPolicy } from "./infrastructure/resilience/timeout-policy";
import { CircuitBreaker } from "./infrastructure/resilience/circuit-breaker";

import { TempFileManager } from "./infrastructure/file-system/temp-file-manager";
import { MemoryMonitor } from "./infrastructure/monitoring/memory-monitor";

import { CommandRegistry } from "./application/commands/command-registry";
import { CommandFactory } from "./application/commands/command-factory";
import { MessageOrchestrator } from "./application/orchestrators/message-orchestrator";
import { PermissionChecker } from "./application/services/permission-checker.service";
import { UserStateService } from "./application/services/user-state.service";

import { HelpHandler } from "./application/commands/handlers/help-handler";
import { StickerHandler } from "./application/commands/handlers/sticker-handler";
import { KickHandler } from "./application/commands/handlers/kick-handler";
import { AddPremiumHandler } from "./application/commands/handlers/add-premium-handler";

interface Container {
  resolve<T>(name: string): T;
  dispose(): Promise<void>;
}

export async function createContainer(env: Environment): Promise<Container> {
  const services = new Map<string, any>();

  // Value Objects
  const ownerPhone = PhoneNumber.create(env.OWNER_PHONE);
  services.set("ownerPhone", ownerPhone);

  // Infrastructure - Monitoring
  const memoryMonitor = new MemoryMonitor();
  memoryMonitor.start();
  services.set("memoryMonitor", memoryMonitor);

  // Infrastructure - File System
  await TempFileManager.initialize();
  services.set("tempFileManager", TempFileManager);

  // Infrastructure - Resilience
  const retryPolicy = new RetryPolicy();
  const timeoutPolicy = new TimeoutPolicy();
  const circuitBreaker = new CircuitBreaker();
  services.set("retryPolicy", retryPolicy);
  services.set("timeoutPolicy", timeoutPolicy);
  services.set("circuitBreaker", circuitBreaker);

  // Infrastructure - Cache
  const redisClient = new RedisClient(env.REDIS_HOST, env.REDIS_PORT);
  services.set("redisClient", redisClient);

  // Infrastructure - Database (Backup)
  const postgresClient = new PostgresClient(
    env.SUPABASE_URL,
    env.SUPABASE_KEY,
    retryPolicy,
    timeoutPolicy,
    circuitBreaker
  );
  services.set("postgresClient", postgresClient);

  // Repositories - Local First with Postgres Backup
  const postgresUserRepo = new PostgresUserRepository(
    postgresClient,
    ownerPhone
  );
  const localUserRepo = new LocalUserRepository(
    redisClient,
    postgresUserRepo,
    ownerPhone
  );
  services.set("userRepository", localUserRepo);

  // Infrastructure - WhatsApp
  const whatsappClientFactory = new WhatsAppClientFactory(env.CHROME_PATH);
  const whatsappClient = await whatsappClientFactory.create();
  services.set("whatsappClient", whatsappClient);

  const mediaValidator = new MediaValidator(whatsappClient);
  services.set("mediaValidator", mediaValidator);

  const messageSender = new MessageSender(
    whatsappClient,
    retryPolicy,
    timeoutPolicy
  );
  services.set("messageSender", messageSender);

  const messageReceiver = new MessageReceiver(whatsappClient);
  services.set("messageReceiver", messageReceiver);

  // Infrastructure - Queue
  const queueClient = new QueueClient(env.REDIS_HOST, env.REDIS_PORT);
  services.set("queueClient", queueClient);

  const mediaProcessor = new MediaProcessor(whatsappClient, messageSender);
  services.set("mediaProcessor", mediaProcessor);

  // Application - Services
  const userStateService = new UserStateService(localUserRepo, redisClient);
  await userStateService.initialize();
  services.set("userStateService", userStateService);

  const permissionChecker = new PermissionChecker(
    redisClient,
    ownerPhone,
    timeoutPolicy
  );
  services.set("permissionChecker", permissionChecker);

  // Application - Commands
  const commandRegistry = new CommandRegistry();
  services.set("commandRegistry", commandRegistry);

  const commandFactory = new CommandFactory(
    commandRegistry,
    localUserRepo,
    queueClient,
    messageSender,
    mediaValidator,
    ownerPhone
  );
  services.set("commandFactory", commandFactory);

  // Register all commands
  commandFactory.registerCommand(HelpHandler);
  commandFactory.registerCommand(StickerHandler);
  commandFactory.registerCommand(KickHandler);
  commandFactory.registerCommand(AddPremiumHandler);

  // Application - Orchestrator
  const messageOrchestrator = new MessageOrchestrator(
    commandRegistry,
    permissionChecker,
    userStateService,
    messageSender,
    env.COMMAND_PREFIX
  );
  services.set("messageOrchestrator", messageOrchestrator);

  return {
    resolve<T>(name: string): T {
      const service = services.get(name);
      if (!service) {
        throw new Error(`Service not found: ${name}`);
      }
      return service as T;
    },

    async dispose(): Promise<void> {
      memoryMonitor.stop();
      await redisClient.close();
      await queueClient.close();
    },
  };
}
