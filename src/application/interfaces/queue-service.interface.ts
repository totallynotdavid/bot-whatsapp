export interface MediaJobData {
  readonly messageId: string;
  readonly chatId: string;
  readonly userId: string;
}

export interface MediaJobResult {
  success: boolean;
  outputPath?: string;
  caption?: string;
  error?: string;
  type?: string;
}

export interface IQueueService {
  addJob(type: string, data: MediaJobData): Promise<void>;
  getQueuePosition(jobId: string): Promise<number>;
}
