import type { Job } from "bullmq";
import type {
  MediaJobData,
  MediaJobResult,
  DocsJobData,
  BaseJobData,
} from "../core/types";
import type { QueueAdapter } from "../adapters/queue-adapter";
import type { WhatsAppSender } from "../adapters/whatsapp-sender";
import type { AnnasDownloadAdapter } from "../adapters/annas-download-adapter";
import { MediaStore } from "../stores/media-store";
import { log } from "../lib/logger";

export class MediaWorker {
  constructor(
    private readonly queueAdapter: QueueAdapter,
    private readonly sender: WhatsAppSender,
    private readonly annasAdapter: AnnasDownloadAdapter
  ) {}

  start(): void {
    this.queueAdapter.startWorker(async (job: Job<any>) => {
      log("info", "Processing media job", { jobId: job.id, type: job.name });

      try {
        switch (job.name) {
          case "sticker":
            return await this.processStickerJob(job.data);
          case "docs":
            return await this.processDocsJob(job.data);
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
      const data = job.data as BaseJobData;
      await this.sendJobResult(data.chatId, data.messageId, result);
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

  private async processDocsJob(data: DocsJobData): Promise<MediaJobResult> {
    try {
      log("info", "Processing docs download", {
        messageId: data.messageId,
        title: data.title,
      });

      const buffer = await this.annasAdapter.downloadBook(
        data.mirror,
        data.md5,
        data.format
      );

      if (!buffer) {
        return {
          success: false,
          errorMessage: "Download failed",
        };
      }

      const outputPath = await MediaStore.saveBuffer(buffer, data.format);

      log("info", "Docs downloaded successfully", {
        messageId: data.messageId,
        outputPath,
        format: data.format,
      });

      return {
        success: true,
        outputFilePath: outputPath,
        caption: `${data.title}${data.author ? ` por ${data.author}` : ""}`,
        resultType: "media",
      };
    } catch (error) {
      log("error", "Docs download failed", {
        messageId: data.messageId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        errorMessage:
          error instanceof Error ? error.message : "Download failed",
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
