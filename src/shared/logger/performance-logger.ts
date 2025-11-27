import { logger } from "../logger";

export class PerformanceLogger {
  private startTime: number;
  private checkpoints: Map<string, number> = new Map();

  constructor(private operation: string) {
    this.startTime = Date.now();
  }

  checkpoint(name: string): void {
    this.checkpoints.set(name, Date.now() - this.startTime);
  }

  finish(metadata?: Record<string, any>): void {
    const duration = Date.now() - this.startTime;
    const checkpoints = Object.fromEntries(this.checkpoints);

    logger.debug("Operation completed", {
      operation: this.operation,
      duration,
      checkpoints,
      ...metadata,
    });
  }

  static measure<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const perfLog = new PerformanceLogger(operation);

    return fn()
      .then((result) => {
        perfLog.finish({ success: true });
        return result;
      })
      .catch((error) => {
        perfLog.finish({ success: false, error: error.message });
        throw error;
      });
  }
}
