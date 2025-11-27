import sharp from "sharp";
import type {
  MediaJobData,
  MediaJobResult,
} from "../../infrastructure/queue/queue.service";
import { FileManager } from "../../infrastructure/file-system/file.manager";
import { WhatsAppClient } from "../../infrastructure/whatsapp/whatsapp.client";

export async function processStickerJob(
  data: MediaJobData
): Promise<MediaJobResult> {
  const client = new WhatsAppClient();
  let inputPath: string | null = null;
  let outputPath: string | null = null;

  try {
    // Download media
    const buffer = await client.downloadMedia(data.messageId);
    inputPath = await FileManager.saveBuffer(buffer, "jpg");

    // Convert to sticker
    outputPath = FileManager.getPath("webp");

    await sharp(inputPath)
      .resize(512, 512, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 80 })
      .toFile(outputPath);

    return {
      success: true,
      outputPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Conversion failed",
    };
  } finally {
    if (inputPath) await FileManager.cleanup(inputPath);
  }
}
