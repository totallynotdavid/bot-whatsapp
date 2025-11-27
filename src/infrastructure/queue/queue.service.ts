import { Queue, Worker, Job } from "bullmq";
import { logger } from "../../shared/logger";

export interface MediaJobData {
  messageId: string;
  chatId: string;
  userId: string;
}

export interface MediaJobResult {
  success: boolean;
  outputPath?: string;
  caption?: string;
  error?: string;
}

export class QueueService {
  private queue: Queue;
  private worker?: Worker;

  constructor(redisHost: string, redisPort: number) {
    this.queue = new Queue("media-processing", {
      connection: { host: redisHost, port: redisPort },
    });
  }

  async addJob(type: string, data: MediaJobData): Promise<void> {
    await this.queue.add(type, data, {
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }

  startWorker(
    processor: (job: Job<MediaJobData>) => Promise<MediaJobResult>
  ): void {
    this.worker = new Worker("media-processing", processor, {
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
      },
      concurrency: 5,
    });

    this.worker.on("failed", (job, err) => {
      logger.error("Job failed", err, { jobId: job?.id });
    });

    this.worker.on("completed", (job) => {
      logger.info("Job completed", { jobId: job.id });
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
