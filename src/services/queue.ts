import { Queue, Worker, Job } from "bullmq";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

export interface JobData {
  jobType: "sticker" | "youtube" | "ai-chat";
  chatId: string;
  userId: string;
  rawMessageId: string;
  inputPath?: string;
  args?: string[];
}

export interface JobResult {
  success: boolean;
  outputPath?: string;
  caption?: string;
  error?: string;
}

export class QueueService {
  private queue: Queue;
  private worker?: Worker;

  constructor() {
    this.queue = new Queue("bot-heavy-tasks", {
      connection: {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
      },
    });
  }

  async addJob(name: string, data: JobData): Promise<void> {
    await this.queue.add(name, data, {
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }

  startWorker(processor: (job: Job<JobData>) => Promise<JobResult>): void {
    this.worker = new Worker("bot-heavy-tasks", processor, {
      connection: {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
      },
      concurrency: 5,
    });

    this.worker.on("failed", (job, err) => {
      logger.error(`Job ${job?.id} failed`, err);
    });
  }

  onJobCompleted(
    callback: (jobId: string, result: JobResult, originalData: JobData) => void
  ) {
    if (!this.worker) return;

    this.worker.on("completed", (job: Job<JobData>, result: JobResult) => {
      logger.debug(`Job ${job.id} completed`);
      callback(job.id || "unknown", result, job.data);
    });
  }
}
