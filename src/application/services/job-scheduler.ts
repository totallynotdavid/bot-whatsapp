import type { JobData } from "../../domain/job";
import type { QueueClient } from "../../infrastructure/queue/client";
import { QUEUE_PRIORITY } from "../../config/constants";

export class JobScheduler {
  constructor(private readonly queueClient: QueueClient) {}

  async scheduleStickerJob(jobData: JobData): Promise<void> {
    await this.queueClient.addJob("sticker", jobData, QUEUE_PRIORITY.HIGH);
  }

  async scheduleSpotifyJob(jobData: JobData): Promise<void> {
    await this.queueClient.addJob("spotify", jobData, QUEUE_PRIORITY.NORMAL);
  }

  async scheduleDocsJob(jobData: JobData): Promise<void> {
    await this.queueClient.addJob("docs", jobData, QUEUE_PRIORITY.LOW);
  }
}
