import { type Job, Queue, Worker } from "bullmq";
import type {
  IQueueService,
  MediaJobData,
} from "../../application/interfaces/queue-service.interface";
import { logger } from "../../shared/logger";

export interface MediaJobResult {
  success: boolean;
  outputPath?: string;
  caption?: string;
  error?: string;
}

export class QueueService implements IQueueService {
  private queue: Queue;
  private worker?: Worker;

  constructor(
    redisHost: string,
    redisPort: number,
    private maxConcurrentJobs: number = 5
  ) {
    this.queue = new Queue("media-processing", {
      connection: { host: redisHost, port: redisPort },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    });
  }

  async addJob(type: string, data: MediaJobData): Promise<void> {
    await this.queue.add(type, data);

    logger.debug("Job added to queue", {
      type,
      messageId: data.messageId,
      userId: data.userId,
    });
  }

  async getQueuePosition(jobId: string): Promise<number> {
    const job = await this.queue.getJob(jobId);
    if (!job) return -1;

    const waiting = await this.queue.getWaiting();
    const index = waiting.findIndex((j) => j.id === jobId);

    return index >= 0 ? index + 1 : 0;
  }

  startWorker(
    processor: (job: Job<MediaJobData>) => Promise<MediaJobResult>
  ): void {
    this.worker = new Worker("media-processing", processor, {
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379", 10),
      },
      concurrency: this.maxConcurrentJobs,
    });

    this.worker.on("failed", (job, err) => {
      logger.error("Job failed", err, {
        jobId: job?.id,
        attempts: job?.attemptsMade,
      });
    });

    this.worker.on("completed", (job) => {
      logger.info("Job completed", {
        jobId: job.id,
        duration: job.finishedOn! - job.processedOn!,
      });
    });

    logger.info("Queue worker started", {
      concurrency: this.maxConcurrentJobs,
    });
  }

  onCompleted(
    handler: (job: Job<MediaJobData>, result: MediaJobResult) => Promise<void>
  ): void {
    if (!this.worker) return;
    this.worker.on("completed", handler);
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.worker?.close();
  }
}
