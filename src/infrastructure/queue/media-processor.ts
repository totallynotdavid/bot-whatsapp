import type { Client } from "whatsapp-web.js";
import type { IMessageSender } from "../whatsapp/message-sender.interface";
import type { MediaJobData, MediaJobResult } from "./queue-client.interface";
import { TempFileManager } from "../file-system/temp-file-manager";
import { logger } from "../monitoring/logger";

export class MediaProcessor {
  constructor(
    private readonly whatsappClient: Client,
    private readonly messageSender: IMessageSender
  ) {}

  async processStickerJob(data: MediaJobData): Promise<MediaJobResult> {
    try {
      logger.info("Processing sticker", { messageId: data.messageId });

      const targetMessageId = data.mediaMessageId || data.messageId;
      const buffer = await this.messageSender.downloadMedia(targetMessageId);

      const mediaInfo = await this.messageSender.getMediaInfo(targetMessageId);
      if (!mediaInfo) {
        return {
          success: false,
          error: "Could not get media info",
        };
      }

      const extension = mediaInfo.mimeType.split("/")[1] || "webp";
      const outputPath = await TempFileManager.saveBuffer(buffer, extension);

      logger.info("Sticker processed successfully", {
        messageId: data.messageId,
        outputPath,
        mimeType: mediaInfo.mimeType,
      });

      return {
        success: true,
        outputPath,
        type: "sticker",
      };
    } catch (error) {
      logger.error("Sticker processing failed", error, {
        messageId: data.messageId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Conversion failed",
      };
    }
  }

  async sendJobResult(
    chatId: string,
    messageId: string,
    result: MediaJobResult
  ): Promise<void> {
    if (!result.success || !result.outputPath) {
      await this.messageSender.sendText(
        chatId,
        `❌ Error: ${result.error}`,
        messageId
      );
      return;
    }

    switch (result.type) {
      case "sticker":
        await this.messageSender.sendSticker(
          chatId,
          result.outputPath,
          messageId
        );
        break;

      default:
        await this.messageSender.sendMedia(
          chatId,
          result.outputPath,
          result.caption,
          messageId
        );
        break;
    }

    await TempFileManager.cleanup(result.outputPath);
  }
}
