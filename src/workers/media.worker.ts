import type { Job } from "bullmq";
import type {
  MediaJobData,
  MediaJobResult,
} from "../infrastructure/queue/queue.service";
import { processStickerJob } from "./processors/sticker.processor";
import { logger } from "../shared/logger";

export async function mediaWorkerProcessor(
  job: Job<MediaJobData>
): Promise<MediaJobResult> {
  logger.info("Processing media job", { jobId: job.id, type: job.name });

  try {
    switch (job.name) {
      case "sticker":
        return await processStickerJob(job.data);

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
