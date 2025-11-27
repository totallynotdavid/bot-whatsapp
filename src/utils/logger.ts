import { config } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: number;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    this.level = this.levels[config.LOG_LEVEL as LogLevel] || 1;
  }

  private log(level: LogLevel, message: string, meta?: object) {
    if (this.levels[level] < this.level) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };

    console.log(JSON.stringify(entry));
  }

  debug(msg: string, meta?: object) { this.log('debug', msg, meta); }
  info(msg: string, meta?: object) { this.log('info', msg, meta); }
  warn(msg: string, meta?: object) { this.log('warn', msg, meta); }
  
  error(msg: string, error?: unknown, meta?: object) {
    const errorObj = error instanceof Error 
      ? { name: error.name, message: error.message, stack: error.stack }
      : { raw: error };
      
    this.log('error', msg, { ...meta, error: errorObj });
  }
}

export const logger = new Logger();