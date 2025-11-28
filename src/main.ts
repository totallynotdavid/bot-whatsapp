import { loadConfig } from "./config";
import { buildContainer } from "./bootstrap/container";
import { start, setupGracefulShutdown } from "./bootstrap/lifecycle";
import { log } from "./lib/logging/logger";

async function bootstrap(): Promise<void> {
  try {
    const config = loadConfig();
    log("info", "Starting bot", { env: config.NODE_ENV });

    const container = await buildContainer();
    await start(container);

    setupGracefulShutdown(container);

    log("info", "Bot is ready", {
      ownerPhone: config.OWNER_PHONE,
      commandPrefix: config.COMMAND_PREFIX,
    });
  } catch (error) {
    log("error", "Fatal startup error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

bootstrap();
