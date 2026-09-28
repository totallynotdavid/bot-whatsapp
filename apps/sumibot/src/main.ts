import { loadConfig } from "./config";
import { buildContainer } from "./bootstrap/container";
import { setupGracefulShutdown, start } from "./bootstrap/lifecycle";
import { createLogger } from "./lib/logging/logger";

async function bootstrap(): Promise<void> {
  try {
    const config = loadConfig();
    const log = createLogger(config.LOG_LEVEL);
    log("info", "Starting bot", {
      env: config.NODE_ENV,
      transport: config.WHATSAPP_TRANSPORT,
    });

    const container = await buildContainer(config, log);
    await start(container, log);
    setupGracefulShutdown(container, log);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Fatal startup error",
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
    );
    process.exit(1);
  }
}

bootstrap();
