import sharp from "sharp";
import type { MediaJobData } from "../../application/interfaces/queue-service.interface";
import { FileManager } from "../../infrastructure/file-system/file.manager";
import type { MediaJobResult } from "../../infrastructure/queue/queue.service";
import { logger } from "../../shared/logger";

export async function processStickerJob(
  data: MediaJobData,
  downloadMedia: (messageId: string) => Promise<Buffer>
): Promise<MediaJobResult> {
  let inputPath: string | null = null;
  let outputPath: string | null = null;

  try {
    logger.info("Processing sticker", { messageId: data.messageId });

    const buffer = await downloadMedia(data.messageId);
    inputPath = await FileManager.saveBuffer(buffer, "jpg");

    outputPath = FileManager.getPath("webp");

    await sharp(inputPath)
      .resize(512, 512, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 80 })
      .toFile(outputPath);

    logger.info("Sticker processed successfully", {
      messageId: data.messageId,
      outputPath,
    });

    return {
      success: true,
      outputPath,
    };
  } catch (error) {
    logger.error("Sticker processing failed", error, {
      messageId: data.messageId,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Conversion failed",
    };
  } finally {
    if (inputPath) await FileManager.cleanup(inputPath);
  }
}
