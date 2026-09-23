import { configSchema, type Config } from "./schema";
import { log } from "../lib/logging/logger";

let cachedConfig: Config | null = null;

export function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Configuration validation failed:");
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  cachedConfig = result.data;
  log("info", "Configuration loaded", {
    env: cachedConfig.NODE_ENV,
    logLevel: cachedConfig.LOG_LEVEL,
  });

  return cachedConfig;
}

export function getConfig(): Config {
  if (!cachedConfig) {
    throw new Error("Config not loaded. Call loadConfig() first");
  }
  return cachedConfig;
}

export * from "./constants";
