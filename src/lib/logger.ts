import { config } from "../config";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel = LOG_LEVELS[config.LOG_LEVEL as LogLevel] ?? LOG_LEVELS.info;

export function log(
  level: LogLevel,
  message: string,
  meta?: Record<string, any>
): void {
  if (LOG_LEVELS[level] < minLevel) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
  } else {
    console.log(output);
  }
}
