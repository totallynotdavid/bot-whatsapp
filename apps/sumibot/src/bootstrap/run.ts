import type { Logger } from "@bot-whatsapp/whatsapp";
import { loadConfig } from "../config";
import { createLogger } from "../lib/logging/logger";
import {
  buildContainer,
  type Container,
  type ContainerOverrides,
} from "./container";
import { createShutdown, start, type Shutdown } from "./lifecycle";

export interface RunOptions extends ContainerOverrides {
  // Defaults to the process environment, read by loadConfig.
  readonly env?: Record<string, string | undefined>;
}

export interface RunningBot {
  readonly container: Container;
  readonly log: Logger;
  readonly shutdown: Shutdown;
}

export async function run(options: RunOptions = {}): Promise<RunningBot> {
  const config = loadConfig(options.env);
  const log = createLogger(config.LOG_LEVEL);
  log("info", "Starting bot", {
    env: config.NODE_ENV,
    transport: config.WHATSAPP_TRANSPORT,
  });

  const container = await buildContainer(config, log, options);
  const shutdown = createShutdown(container, log);
  await start(container, log, shutdown);
  return { container, log, shutdown };
}
