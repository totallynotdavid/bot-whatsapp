import { UnrecoverableError } from "bullmq";
import type { z } from "zod";
import type { JobName, JobPayload } from "../../domain/job";

export interface JobLimits {
  readonly concurrency: number;
  readonly timeoutMs: number;
  readonly attempts: number;
}

export interface JobDefinition<N extends JobName> {
  readonly name: N;
  readonly schema: z.ZodType<JobPayload<N>>;
  readonly limits: JobLimits;
  // Shown to the user when the last attempt fails for any reason other than
  // a JobRejectedError.
  readonly failureMessage: string;
  // Does the work and delivers the reply; the job is complete only when this
  // resolves. The signal aborts when the job times out.
  run(payload: JobPayload<N>, signal: AbortSignal): Promise<void>;
}

export type JobDefinitions = { readonly [N in JobName]: JobDefinition<N> };

export type AnyJobDefinition = JobDefinitions[JobName];

// A job that can never succeed. BullMQ skips its remaining attempts, and its
// message is what the user sees.
export class JobRejectedError extends UnrecoverableError {}
