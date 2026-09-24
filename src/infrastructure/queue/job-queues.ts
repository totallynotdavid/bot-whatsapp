import { Queue, Worker, type ConnectionOptions } from "bullmq";
import type { JobName, JobPayload } from "../../domain/job";
import type { JobScheduler } from "../../application/ports/job-scheduler";
import type { MessageSender } from "../../application/ports/message-sender";
import { log } from "../../lib/logging/logger";
import type { AnyJobDefinition, JobDefinitions } from "./job-definition";
import { reportFailure, runJob } from "./job-runner";

const COMPLETED_JOBS_TO_KEEP = 100;
const FAILED_JOBS_TO_KEEP = 500;
const BACKOFF_DELAY_MS = 2000;

export class JobQueues implements JobScheduler {
  private readonly queues = new Map<JobName, Queue>();
  private readonly workers: Worker[] = [];
  private readonly pendingReports = new Set<Promise<void>>();

  constructor(
    private readonly connection: ConnectionOptions,
    private readonly definitions: JobDefinitions,
    private readonly sender: Pick<MessageSender, "sendText">
  ) {
    for (const definition of this.allDefinitions()) {
      this.queues.set(
        definition.name,
        new Queue(definition.name, {
          connection,
          defaultJobOptions: {
            attempts: definition.limits.attempts,
            backoff: { type: "exponential", delay: BACKOFF_DELAY_MS },
            removeOnComplete: COMPLETED_JOBS_TO_KEEP,
            removeOnFail: FAILED_JOBS_TO_KEEP,
          },
        })
      );
    }
  }

  async enqueue<N extends JobName>(
    name: N,
    payload: JobPayload<N>
  ): Promise<void> {
    const queue = this.queues.get(name);
    if (!queue) throw new Error(`No queue for job type ${name}`);
    await queue.add(name, payload);
    log("debug", "Job added to queue", { jobType: name });
  }

  startWorkers(): void {
    for (const definition of this.allDefinitions()) {
      const worker = new Worker(
        definition.name,
        (job) => runJob(definition, job.data),
        {
          connection: this.connection,
          concurrency: definition.limits.concurrency,
        }
      );

      worker.on("failed", (job, error) => {
        const report = reportFailure(definition, job, error, this.sender);
        this.pendingReports.add(report);
        void report.finally(() => this.pendingReports.delete(report));
      });

      worker.on("completed", (job) => {
        log("info", "Job completed", {
          jobId: job.id,
          jobType: definition.name,
          durationMs:
            job.finishedOn && job.processedOn
              ? job.finishedOn - job.processedOn
              : undefined,
        });
      });

      worker.on("error", (error) => {
        log("error", "Queue worker error", {
          jobType: definition.name,
          error: error.message,
        });
      });

      this.workers.push(worker);
      log("info", "Queue worker started", {
        jobType: definition.name,
        ...definition.limits,
      });
    }
  }

  // Failure reports are awaited because event listeners aren't tracked by Worker.close.
  async stopWorkers(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
    await Promise.all(this.pendingReports);
  }

  async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }

  private allDefinitions(): AnyJobDefinition[] {
    return Object.values(this.definitions);
  }
}
