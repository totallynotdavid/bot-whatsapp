import type { Job } from "bullmq";

export interface MediaJobData {
  readonly messageId: string;
  readonly chatId: string;
  readonly userId: string;
  readonly mediaMessageId?: string;
}

export interface MediaJobResult {
  success: boolean;
  outputPath?: string;
  caption?: string;
  error?: string;
  type?: string;
}

export interface IQueueClient {
  addJob(type: string, data: MediaJobData): Promise<void>;
  getQueuePosition(jobId: string): Promise<number>;
  startWorker(
    processor: (job: Job<MediaJobData>) => Promise<MediaJobResult>
  ): void;
  onCompleted(
    handler: (job: Job<MediaJobData>, result: MediaJobResult) => Promise<void>
  ): void;
  close(): Promise<void>;
}
