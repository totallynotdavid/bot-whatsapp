import { getConfig } from "../../config";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function log(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>
): void {
  const config = getConfig();
  const minPriority =
    LOG_LEVEL_PRIORITY[config.LOG_LEVEL as LogLevel] ?? LOG_LEVEL_PRIORITY.info;

  if (LOG_LEVEL_PRIORITY[level] < minPriority) {
    return;
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata,
  };

  const serialized = JSON.stringify(logEntry);

  if (level === "error") {
    console.error(serialized);
  } else {
    console.log(serialized);
  }
}
