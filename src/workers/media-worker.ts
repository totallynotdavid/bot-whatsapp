import { Job } from "bullmq";
import type { JobData } from "../services/queue";
import { logger } from "../utils/logger";

export async function mediaWorkerProcessor(job: Job<JobData>) {
  const { jobType, chatId } = job.data;

  logger.info(`Processing background job: ${jobType} for ${chatId}`);

  try {
    switch (jobType) {
      case "sticker":
        await simulateWork(2000);
        break;

      case "youtube":
        await simulateWork(5000);
        break;

      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }
  } catch (error) {
    logger.error(`Worker error for ${jobType}`, error);
    throw error;
  }
}

function simulateWork(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
