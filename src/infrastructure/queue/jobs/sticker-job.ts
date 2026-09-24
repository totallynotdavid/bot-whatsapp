import { jobPayloadSchemas } from "../../../domain/job";
import type { WhatsAppSender } from "../../whatsapp/sender";
import type { TempFileStore } from "../../storage/temp-file-store";
import { JobRejectedError, type JobDefinition } from "../job-definition";

export interface StickerJobDeps {
  readonly sender: Pick<WhatsAppSender, "downloadMedia" | "sendSticker">;
  readonly tempFiles: Pick<TempFileStore, "saveBuffer" | "cleanup">;
}

export function stickerJob({
  sender,
  tempFiles,
}: StickerJobDeps): JobDefinition<"sticker"> {
  return {
    name: "sticker",
    schema: jobPayloadSchemas.sticker,
    limits: { concurrency: 5, timeoutMs: 120_000, attempts: 3 },
    failureMessage: "Error al procesar el sticker",

    async run({ chatId, messageId, targetMessageId }, signal) {
      const media = await sender.downloadMedia(targetMessageId, signal);
      if (!media) {
        throw new JobRejectedError("No se pudo obtener información del medio");
      }

      const extension = media.mimeType.split("/")[1] || "webp";
      const filePath = await tempFiles.saveBuffer(media.buffer, extension);
      try {
        signal.throwIfAborted();
        await sender.sendSticker(chatId, filePath, messageId);
      } finally {
        await tempFiles.cleanup(filePath);
      }
    },
  };
}
