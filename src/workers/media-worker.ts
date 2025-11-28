import type { Job } from "bullmq";
import type { MediaJobData, MediaJobResult } from "../core/types";
import type { QueueAdapter } from "../adapters/queue-adapter";
import type { WhatsAppSender } from "../adapters/whatsapp-sender";
import { MediaStore } from "../stores/media-store";
import { log } from "../lib/logger";

export class MediaWorker {
  constructor(
    private readonly queueAdapter: QueueAdapter,
    private readonly sender: WhatsAppSender
  ) {}

  start(): void {
    this.queueAdapter.startWorker(async (job: Job<MediaJobData>) => {
      log("info", "Processing media job", { jobId: job.id, type: job.name });

      try {
        switch (job.name) {
          case "sticker":
            return await this.processStickerJob(job.data);
          default:
            throw new Error(`Unknown job type: ${job.name}`);
        }
      } catch (error) {
        log("error", "Media worker error", {
          jobId: job.id,
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          success: false,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    this.queueAdapter.onCompleted(async (job, result) => {
      await this.sendJobResult(job.data.chatId, job.data.messageId, result);
    });

    log("info", "Media worker started");
  }

  private async processStickerJob(data: MediaJobData): Promise<MediaJobResult> {
    try {
      log("info", "Processing sticker", { messageId: data.messageId });

      const buffer = await this.sender.downloadMedia(data.targetMessageId);
      const mediaInfo = await this.sender.getMediaInfo(data.targetMessageId);

      if (!mediaInfo) {
        return {
          success: false,
          errorMessage: "Could not get media info",
        };
      }

      const extension = mediaInfo.mimeType.split("/")[1] || "webp";
      const outputPath = await MediaStore.saveBuffer(buffer, extension);

      log("info", "Sticker processed successfully", {
        messageId: data.messageId,
        outputPath,
        mimeType: mediaInfo.mimeType,
      });

      return {
        success: true,
        outputFilePath: outputPath,
        resultType: "sticker",
      };
    } catch (error) {
      log("error", "Sticker processing failed", {
        messageId: data.messageId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        errorMessage:
          error instanceof Error ? error.message : "Conversion failed",
      };
    }
  }

  private async sendJobResult(
    chatId: string,
    messageId: string,
    result: MediaJobResult
  ): Promise<void> {
    if (!result.success || !result.outputFilePath) {
      await this.sender.sendText(
        chatId,
        `❌ Error: ${result.errorMessage}`,
        messageId
      );
      return;
    }

    switch (result.resultType) {
      case "sticker":
        await this.sender.sendSticker(chatId, result.outputFilePath, messageId);
        break;
      default:
        await this.sender.sendMedia(
          chatId,
          result.outputFilePath,
          result.caption,
          messageId
        );
        break;
    }

    await MediaStore.cleanup(result.outputFilePath);
  }
}
