import { Queue, Worker, type Job } from "bullmq";
import type { JobData, JobResult } from "../../domain/job";
import { LIMITS, TIMEOUTS, QUEUE_PRIORITY } from "../../config/constants";
import { log } from "../../lib/logging/logger";

const QUEUE_NAME = "media-processing";
const COMPLETED_JOBS_TO_KEEP = 100;
const FAILED_JOBS_TO_KEEP = 500;
const BACKOFF_TYPE = "exponential";
const BACKOFF_DELAY_MS = 2000;

export class QueueClient {
  private readonly queue: Queue;
  private worker?: Worker;

  constructor(redisHost: string, redisPort: number) {
    this.queue = new Queue(QUEUE_NAME, {
      connection: { host: redisHost, port: redisPort },
      defaultJobOptions: {
        removeOnComplete: COMPLETED_JOBS_TO_KEEP,
        removeOnFail: FAILED_JOBS_TO_KEEP,
        attempts: LIMITS.RETRY_MAX_ATTEMPTS,
        backoff: { type: BACKOFF_TYPE, delay: BACKOFF_DELAY_MS },
        // timeout: TIMEOUTS.QUEUE_JOB_MS,
      },
    });
  }

  async addJob(
    jobType: string,
    jobData: JobData,
    priority?: number
  ): Promise<void> {
    await this.queue.add(jobType, jobData, {
      priority: priority ?? QUEUE_PRIORITY.NORMAL,
    });

    log("debug", "Job added to queue", { jobType, priority });
  }

  startWorker(processor: (job: Job<JobData>) => Promise<JobResult>): void {
    this.worker = new Worker(QUEUE_NAME, processor, {
      connection: {
        host: process.env["REDIS_HOST"] || "localhost",
        port: parseInt(process.env["REDIS_PORT"] || "6379", 10),
      },
      concurrency: LIMITS.QUEUE_CONCURRENCY,
    });

    this.worker.on("failed", (job, error) => {
      log("error", "Job failed", {
        jobId: job?.id,
        jobType: job?.name,
        attemptsMade: job?.attemptsMade,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    this.worker.on("completed", (job) => {
      const durationMs =
        job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : 0;
      log("info", "Job completed", {
        jobId: job.id,
        jobType: job.name,
        durationMs,
      });
    });

    log("info", "Queue worker started", {
      concurrency: LIMITS.QUEUE_CONCURRENCY,
      timeoutMs: TIMEOUTS.QUEUE_JOB_MS,
    });
  }

  onCompleted(
    handler: (job: Job<JobData>, result: JobResult) => Promise<void>
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
