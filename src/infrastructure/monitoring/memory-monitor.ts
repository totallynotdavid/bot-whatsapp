import { MEMORY } from "../../config/constants";
import { logger } from "./logger";

export class MemoryMonitor {
  private intervalId?: NodeJS.Timeout;

  start(): void {
    this.intervalId = setInterval(() => {
      this.checkMemoryUsage();
    }, MEMORY.CHECK_INTERVAL_MS);

    logger.info("Memory monitor started", {
      threshold: MEMORY.WARNING_THRESHOLD_PERCENT,
      intervalMs: MEMORY.CHECK_INTERVAL_MS,
    });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
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

  private checkMemoryUsage(): void {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const usagePercent = usage.heapUsed / usage.heapTotal;

    if (usagePercent >= MEMORY.WARNING_THRESHOLD_PERCENT) {
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
}
