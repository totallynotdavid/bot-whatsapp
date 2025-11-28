import { Queue, Worker, type Job } from "bullmq";
import type { MediaJobResult } from "../core/types";
import { LIMITS } from "../config";
import { log } from "../lib/logger";

export class QueueAdapter {
  private readonly queue: Queue;
  private worker?: Worker;

  constructor(redisHost: string, redisPort: number) {
    this.queue = new Queue("media-processing", {
      connection: { host: redisHost, port: redisPort },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    });
  }

  async addJob<T>(type: string, data: T): Promise<void> {
    await this.queue.add(type, data);

    log("debug", "Job added to queue", {
      type,
    });
  }

  startWorker<T>(processor: (job: Job<T>) => Promise<MediaJobResult>): void {
    this.worker = new Worker("media-processing", processor, {
      connection: {
        host: process.env["REDIS_HOST"] || "localhost",
        port: parseInt(process.env["REDIS_PORT"] || "6379", 10),
      },
      concurrency: LIMITS.QUEUE_MAX_CONCURRENT,
    });

    this.worker.on("failed", (job, error) => {
      log("error", "Job failed", {
        jobId: job?.id,
        attempts: job?.attemptsMade,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    this.worker.on("completed", (job) => {
      log("info", "Job completed", {
        jobId: job.id,
        durationMs: job.finishedOn! - job.processedOn!,
      });
    });

    log("info", "Queue worker started", {
      concurrency: LIMITS.QUEUE_MAX_CONCURRENT,
    });
  }

  onCompleted<T>(
    handler: (job: Job<T>, result: MediaJobResult) => Promise<void>
  ): void {
    if (this.worker) {
      this.worker.on("completed", handler);
    }
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.worker?.close();
  }
}
