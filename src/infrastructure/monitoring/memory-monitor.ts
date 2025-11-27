import { logger } from "../../shared/logger";

export class MemoryMonitor {
  private warningThreshold = 0.85;
  private checkIntervalMs = 30000;
  private intervalId?: NodeJS.Timeout;

  start(): void {
    this.intervalId = setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkIntervalMs);

    logger.info("Memory monitor started", {
      threshold: this.warningThreshold,
      intervalMs: this.checkIntervalMs,
    });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private checkMemoryUsage(): void {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const usagePercent = usage.heapUsed / usage.heapTotal;

    if (usagePercent >= this.warningThreshold) {
      logger.warn("High memory usage detected", {
        heapUsedMB: heapUsedMB.toFixed(2),
        heapTotalMB: heapTotalMB.toFixed(2),
        usagePercent: `${(usagePercent * 100).toFixed(2)}%`,
      });

      if (global.gc) {
        global.gc();
        logger.info("Manual garbage collection triggered");
      }
    }
  }

  getCurrentUsage(): {
    heapUsedMB: number;
    heapTotalMB: number;
    usagePercent: number;
  } {
    const usage = process.memoryUsage();
    return {
      heapUsedMB: usage.heapUsed / 1024 / 1024,
      heapTotalMB: usage.heapTotal / 1024 / 1024,
      usagePercent: usage.heapUsed / usage.heapTotal,
    };
  }
}
