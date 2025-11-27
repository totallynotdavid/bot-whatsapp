import { createContainer } from "./container";
import { MessageReceiver } from "./infrastructure/whatsapp/message-receiver";
import { MessageOrchestrator } from "./application/orchestrators/message-orchestrator";
import { startMediaWorker } from "./workers/media-worker";
import { logger } from "./infrastructure/monitoring/logger";
import { loadEnvironment } from "./config/environment";

async function bootstrap(): Promise<void> {
  logger.info("Bot starting");

  const env = loadEnvironment();
  const container = await createContainer(env);

  const receiver = container.resolve<MessageReceiver>("messageReceiver");
  const orchestrator = container.resolve<MessageOrchestrator>(
    "messageOrchestrator"
  );

  await receiver.initialize();
  receiver.onMessage(async (message) => {
    await orchestrator.handleMessage(message);
  });

  startMediaWorker(container);

  logger.info("Bot started successfully");

  const shutdown = async (): Promise<void> => {
    logger.info("Shutting down");
    await container.dispose();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  logger.error("Fatal startup error", error);
  process.exit(1);
});
