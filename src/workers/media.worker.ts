import type { Job } from "bullmq";
import type {
  MediaJobData,
  MediaJobResult,
} from "../application/interfaces/queue-service.interface";
import { logger } from "../shared/logger";
import { processStickerJob } from "./processors/sticker.processor";

export async function mediaWorkerProcessor(
  job: Job<MediaJobData>,
  downloadMedia: (messageId: string) => Promise<Buffer>
): Promise<MediaJobResult> {
  logger.info("Processing media job", { jobId: job.id, type: job.name });

  try {
    switch (job.name) {
      case "sticker":
        return await processStickerJob(job.data, downloadMedia);

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
