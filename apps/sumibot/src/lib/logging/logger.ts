import type { Logger, LogLevel } from "@bot-whatsapp/whatsapp";

const PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function createLogger(minLevel: LogLevel): Logger {
  return (level, message, metadata) => {
    if (PRIORITY[level] < PRIORITY[minLevel]) {
      return;
    }

    const serialized = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...metadata,
    });

    if (level === "error") {
      console.error(serialized);
    } else {
      console.log(serialized);
    }
  };
}
