import type {
  MediaJobData,
  MediaJobResult,
} from "../../application/interfaces/queue-service.interface";
import { FileManager } from "../../infrastructure/file-system/file.manager";
import { logger } from "../../shared/logger";

export async function processStickerJob(
  data: MediaJobData,
  downloadMedia: (messageId: string) => Promise<Buffer>,
  getMediaInfo: (
    messageId: string
  ) => Promise<{ size: number; mimeType: string } | null>
): Promise<MediaJobResult> {
  try {
    logger.info("Processing sticker", { messageId: data.messageId });

    const mediaInfo = await getMediaInfo(data.mediaMessageId || data.messageId);
    if (!mediaInfo) {
      return {
        success: false,
        error: "Could not get media info",
      };
    }

    const buffer = await downloadMedia(data.mediaMessageId || data.messageId);
    const ext = mediaInfo.mimeType.split("/")[1] || "webp";
    const inputPath = await FileManager.saveBuffer(buffer, ext);

    logger.info("Sticker processed successfully", {
      messageId: data.messageId,
      outputPath: inputPath,
      mimeType: mediaInfo.mimeType,
    });

    return {
      success: true,
      outputPath: inputPath,
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
