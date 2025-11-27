import { Job } from "bullmq";
import type { JobData, JobResult } from "../services/queue";
import { logger } from "../utils/logger";
import { processSticker } from "./processors/sticker";

export async function mediaWorkerProcessor(
  job: Job<JobData>
): Promise<JobResult> {
  const { jobType, chatId } = job.data;

  logger.info(`Processing background job: ${jobType} for ${chatId}`);

  try {
    switch (jobType) {
      case "sticker":
        return await processSticker(job.data);

      case "youtube":
        return { success: false, error: "Not implemented" };

      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }
  } catch (error: any) {
    logger.error(`Worker error for ${jobType}`, error);
    return {
      success: false,
      error: error.message || "Worker crashed",
    };
  }
}
