import type { Job } from "bullmq";
import type {
  JobData,
  JobResult,
  StickerJobData,
  SpotifyJobData,
  DocsJobData,
} from "../../domain/job";
import type { StickerProcessor } from "../../infrastructure/queue/processors/sticker-processor";
import type { SpotifyProcessor } from "../../infrastructure/queue/processors/spotify-processor";
import type { DocsProcessor } from "../../infrastructure/queue/processors/docs-processor";
import type { WhatsAppSender } from "../../infrastructure/whatsapp/sender";
import type { TempFileStore } from "../../infrastructure/storage/temp-file-store";
import { TEMP_FILE_CLEANUP_DELAY_MS } from "../../config/constants";
import { log } from "../../lib/logging/logger";

export class JobHandler {
  constructor(
    private readonly stickerProcessor: StickerProcessor,
    private readonly spotifyProcessor: SpotifyProcessor,
    private readonly docsProcessor: DocsProcessor,
    private readonly sender: WhatsAppSender,
    private readonly tempFileStore: TempFileStore
  ) {}

  async processJob(job: Job<JobData>): Promise<JobResult> {
    log("info", "Processing job", { jobId: job.id, jobType: job.name });

    try {
      switch (job.name) {
        case "sticker":
          return await this.stickerProcessor.process(
            job.data as StickerJobData
          );
        case "spotify":
          return await this.spotifyProcessor.process(
            job.data as SpotifyJobData
          );
        case "docs":
          return await this.docsProcessor.process(job.data as DocsJobData);
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      log("error", "Job processing failed", {
        jobId: job.id,
        jobType: job.name,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async handleJobCompletion(
    job: Job<JobData>,
    result: JobResult
  ): Promise<void> {
    const jobData = job.data;

    try {
      if (!result.success || !result.outputFilePath) {
        await this.sender.sendText(
          jobData.chatId,
          `❌ Error: ${result.errorMessage}`,
          jobData.messageId
        );
        return;
      }

      switch (result.resultType) {
        case "sticker":
          await this.sender.sendSticker(
            jobData.chatId,
            result.outputFilePath,
            jobData.messageId
          );
          break;

        case "audio":
          await this.sender.sendText(
            jobData.chatId,
            result.caption || "",
            jobData.messageId
          );
          await this.sender.sendMedia(
            jobData.chatId,
            result.outputFilePath,
            undefined,
            jobData.messageId,
            true
          );
          break;

        // case "media": removed because the default case covers it
        default:
          await this.sender.sendMedia(
            jobData.chatId,
            result.outputFilePath,
            result.caption,
            jobData.messageId
          );
          break;
      }

      this.scheduleCleanup(result.outputFilePath);
    } catch (error) {
      log("error", "Failed to send job result", {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private scheduleCleanup(filePath: string): void {
    setTimeout(() => {
      this.tempFileStore.cleanup(filePath).catch((error) => {
        log("warn", "Scheduled cleanup failed", {
          filePath,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, TEMP_FILE_CLEANUP_DELAY_MS);
  }
}
