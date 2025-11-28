import { MEMORY, config } from "../config";
import { log } from "./logger";

export class Monitor {
  private memoryIntervalId?: NodeJS.Timeout;

  start(): void {
    if (!config.ENABLE_MONITORING) {
      log("info", "Monitoring disabled via config");
      return;
    }

    this.memoryIntervalId = setInterval(() => {
      this.checkMemory();
    }, MEMORY.CHECK_INTERVAL_MS);

    log("info", "Monitor started", {
      threshold: MEMORY.WARNING_THRESHOLD_PERCENT,
      intervalMs: MEMORY.CHECK_INTERVAL_MS,
    });
  }

  stop(): void {
    if (this.memoryIntervalId) {
      clearInterval(this.memoryIntervalId);
      this.memoryIntervalId = undefined;
    }
  }

  private checkMemory(): void {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const usagePercent = usage.heapUsed / usage.heapTotal;

    if (usagePercent >= MEMORY.WARNING_THRESHOLD_PERCENT) {
      log("warn", "High memory usage detected", {
        heapUsedMB: heapUsedMB.toFixed(2),
        heapTotalMB: heapTotalMB.toFixed(2),
        usagePercent: `${(usagePercent * 100).toFixed(2)}%`,
      });

      if (global.gc) {
        global.gc();
        log("info", "Manual garbage collection triggered");
      }
    }
  }
}
