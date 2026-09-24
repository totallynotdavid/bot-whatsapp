import { UnrecoverableError } from "bullmq";
import { z } from "zod";
import { jobReplyTargetSchema, type JobName } from "../../domain/job";
import type { WhatsAppSender } from "../whatsapp/sender";
import { withTimeout } from "../../lib/resilience/timeout";
import { log } from "../../lib/logging/logger";
import {
  JobRejectedError,
  type AnyJobDefinition,
  type JobDefinition,
} from "./job-definition";

export interface JobAttempt {
  readonly id?: string;
  readonly data: unknown;
  readonly attemptsMade: number;
  readonly opts: { readonly attempts?: number };
}

export async function runJob<N extends JobName>(
  definition: JobDefinition<N>,
  data: unknown
): Promise<void> {
  const parsed = definition.schema.safeParse(data);
  if (!parsed.success) {
    throw new UnrecoverableError(
      `Invalid ${definition.name} payload: ${z.prettifyError(parsed.error)}`
    );
  }

  await withTimeout(
    (signal) => definition.run(parsed.data, signal),
    definition.limits.timeoutMs,
    `${definition.name} job`
  );
}

// BullMQ 6 emits "failed" after incrementing attemptsMade, and retries only
// while attemptsMade < attempts and the error is not an UnrecoverableError
// (matched by class or by name).
export function isFinalFailure(job: JobAttempt, error: Error): boolean {
  return (
    error instanceof UnrecoverableError ||
    error.name === "UnrecoverableError" ||
    job.attemptsMade >= (job.opts.attempts ?? 1)
  );
}

export async function reportFailure(
  definition: AnyJobDefinition,
  job: JobAttempt | undefined,
  error: Error,
  sender: Pick<WhatsAppSender, "sendText">
): Promise<void> {
  const final = job !== undefined && isFinalFailure(job, error);
  log(final ? "error" : "warn", "Job attempt failed", {
    jobId: job?.id,
    jobType: definition.name,
    attemptsMade: job?.attemptsMade,
    final,
    error: error.message,
  });
  if (!final) return;

  const target = jobReplyTargetSchema.safeParse(job.data);
  if (!target.success) return;

  const reason =
    error instanceof JobRejectedError
      ? error.message
      : definition.failureMessage;
  try {
    await sender.sendText(
      target.data.chatId,
      `❌ Error: ${reason}`,
      target.data.messageId
    );
  } catch (sendError) {
    log("error", "Failed to report job failure", {
      jobId: job.id,
      jobType: definition.name,
      error: sendError instanceof Error ? sendError.message : String(sendError),
    });
  }
}
