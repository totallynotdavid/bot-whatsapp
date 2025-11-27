type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private minLevel: number;

  constructor() {
    const envLevel = (process.env.LOG_LEVEL || "info") as LogLevel;
    this.minLevel = LOG_LEVELS[envLevel] ?? LOG_LEVELS.info;
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
    const errorMeta = this.extractErrorMetadata(error);
    this.log("error", message, { ...meta, ...errorMeta });
  }

  private log(
    level: LogLevel,
    message: string,
    meta?: Record<string, any>
  ): void {
    if (LOG_LEVELS[level] < this.minLevel) return;

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

  private extractErrorMetadata(error: unknown): Record<string, any> {
    if (error instanceof Error) {
      return {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      };
    }

    return { error: String(error) };
  }
}

export const logger = new Logger();
