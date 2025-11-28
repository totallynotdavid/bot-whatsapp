import { logger } from "./logger";

export class PerformanceTracker {
  private readonly startTime: number;
  private readonly operation: string;
  private lastCheckpoint: number;

  constructor(operation: string) {
    this.operation = operation;
    this.startTime = Date.now();
    this.lastCheckpoint = this.startTime;
  }

  checkpoint(name: string): void {
    const now = Date.now();
    const duration = now - this.lastCheckpoint;
    this.lastCheckpoint = now;

    logger.debug(`Performance checkpoint: ${this.operation}.${name}`, {
      duration,
      total: now - this.startTime,
    });
  }

  finish(data?: Record<string, any>): void {
    const totalDuration = Date.now() - this.startTime;

    logger.info(`Performance finished: ${this.operation}`, {
      totalDuration,
      ...data,
    });
  }
}
