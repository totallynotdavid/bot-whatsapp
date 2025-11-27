import type { Job } from "bullmq";
import type {
  MediaJobData,
  MediaJobResult,
} from "../infrastructure/queue/queue-client.interface";
import type { QueueClient } from "../infrastructure/queue/queue-client";
import type { MediaProcessor } from "../infrastructure/queue/media-processor";
import { logger } from "../infrastructure/monitoring/logger";

export function startMediaWorker(container: any): void {
  const queueClient = container.resolve("queueClient") as QueueClient;
  const mediaProcessor = container.resolve("mediaProcessor") as MediaProcessor;

  queueClient.startWorker(
    async (job: Job<MediaJobData>): Promise<MediaJobResult> => {
      logger.info("Processing media job", { jobId: job.id, type: job.name });

      try {
        switch (job.name) {
          case "sticker":
            return await mediaProcessor.processStickerJob(job.data);

          default:
            throw new Error(`Unknown job type: ${job.name}`);
        }
      } catch (error) {
        logger.error("Media worker error", error, { jobId: job.id });

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  queueClient.onCompleted(
    async (job: Job<MediaJobData>, result: MediaJobResult) => {
      await mediaProcessor.sendJobResult(
        job.data.chatId,
        job.data.messageId,
        result
      );
    }
  );

  logger.info("Media worker started");
}
