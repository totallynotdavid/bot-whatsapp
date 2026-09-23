import type { StickerJobData, JobResult } from "../../../domain/job";
import { createSuccessResult, createFailureResult } from "../../../domain/job";
import type { WhatsAppSender } from "../../whatsapp/sender";
import type { TempFileStore } from "../../storage/temp-file-store";
import { log } from "../../../lib/logging/logger";

export class StickerProcessor {
  constructor(
    private readonly sender: WhatsAppSender,
    private readonly tempFileStore: TempFileStore
  ) {}

  async process(jobData: StickerJobData): Promise<JobResult> {
    try {
      log("info", "Processing sticker job", {
        messageId: jobData.messageId,
        userId: jobData.userId,
      });

      const buffer = await this.sender.downloadMedia(jobData.targetMessageId);
      const mediaInfo = await this.sender.getMediaInfo(jobData.targetMessageId);

      if (!mediaInfo) {
        return createFailureResult("No se pudo obtener información del medio");
      }

      const extension = mediaInfo.mimeType.split("/")[1] || "webp";
      const outputPath = await this.tempFileStore.saveBuffer(buffer, extension);

      log("info", "Sticker processed successfully", {
        messageId: jobData.messageId,
        outputPath,
        mimeType: mediaInfo.mimeType,
      });

      return createSuccessResult(outputPath, "sticker");
    } catch (error) {
      log("error", "Sticker processing failed", {
        messageId: jobData.messageId,
        error: error instanceof Error ? error.message : String(error),
      });

      return createFailureResult(
        error instanceof Error ? error.message : "Error al procesar el sticker"
      );
    }
  }
}
