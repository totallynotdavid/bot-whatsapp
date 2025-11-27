import sharp from "sharp";
import { FileManager } from "../../utils/file-manager";
import type { JobData, JobResult } from "../../services/queue";

export async function processSticker(data: JobData): Promise<JobResult> {
  if (!data.inputPath) {
    throw new Error("No input file provided");
  }

  const outputPath = FileManager.getOutputPath("webp");

  try {
    await sharp(data.inputPath)
      .resize(512, 512, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 80 })
      .toFile(outputPath);

    return {
      success: true,
      outputPath: outputPath,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to convert sticker",
    };
  }
}
