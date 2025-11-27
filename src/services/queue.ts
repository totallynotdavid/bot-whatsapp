import { Queue, Worker, Job } from "bullmq";
import { config } from "../config/env";
import { logger } from "../utils/logger";

export interface JobData {
  jobType: "sticker" | "youtube" | "ai-chat";
  chatId: string;
  userId: string;
  args: string[];
  rawMessageId: string;
  mediaData?: {
    mimeType: string;
    data: string;
  };
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
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }

  /**
   * Initialize the worker to process jobs
   * @param processor Function that handles the job logic
   */
  startWorker(processor: (job: Job<JobData>) => Promise<any>): void {
    this.worker = new Worker("bot-heavy-tasks", processor, {
      connection: {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
      },
      concurrency: 5,
    });

    this.worker.on("completed", (job) => {
      logger.debug(`Job ${job.id} completed`);
    });

    this.worker.on("failed", (job, err) => {
      logger.error(`Job ${job?.id} failed`, err);
    });
  }
}
