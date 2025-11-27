type LogLevel = "debug" | "info" | "warn" | "error";

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private minLevel: number;

  constructor() {
    const envLevel = (process.env.LOG_LEVEL || "info") as LogLevel;
    this.minLevel = levels[envLevel] || levels.info;
  }

  private log(
    level: LogLevel,
    message: string,
    meta?: Record<string, any>
  ): void {
    if (levels[level] < this.minLevel) return;

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

  debug(message: string, meta?: Record<string, any>): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.log("warn", message, meta);
  }

  error(message: string, error?: unknown, meta?: Record<string, any>): void {
    const errorMeta =
      error instanceof Error
        ? {
            errorName: error.name,
            errorMessage: error.message,
            stack: error.stack,
          }
        : { error };

    this.log("error", message, { ...meta, ...errorMeta });
  }
}

export const logger = new Logger();
