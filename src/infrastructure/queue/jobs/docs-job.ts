import { jobPayloadSchemas } from "../../../domain/job";
import type { AnnasArchiveClient } from "../../external/annas-archive-client";
import type { MessageSender } from "../../../application/ports/message-sender";
import type { TempStore } from "../../../application/ports/temp-store";
import { JobRejectedError, type JobDefinition } from "../job-definition";

export interface DocsJobDeps {
  readonly annas: Pick<AnnasArchiveClient, "downloadBook">;
  readonly sender: Pick<MessageSender, "sendMedia">;
  readonly tempFiles: Pick<TempStore, "saveBuffer" | "cleanup">;
}

export function docsJob({
  annas,
  sender,
  tempFiles,
}: DocsJobDeps): JobDefinition<"docs"> {
  return {
    name: "docs",
    schema: jobPayloadSchemas.docs,
    // Each job drives a page in the one shared headless Chrome.
    limits: { concurrency: 1, timeoutMs: 300_000, attempts: 3 },
    failureMessage: "Error al descargar el documento",

    async run({ chatId, messageId, mirror, format, title, author }, signal) {
      const buffer = await annas.downloadBook(mirror, signal);
      if (!buffer) {
        throw new JobRejectedError("No se pudo descargar el documento");
      }

      const filePath = await tempFiles.saveBuffer(buffer, format);
      try {
        signal.throwIfAborted();
        await sender.sendMedia(
          chatId,
          filePath,
          author ? `${title} por ${author}` : title,
          messageId
        );
      } finally {
        await tempFiles.cleanup(filePath);
      }
    },
  };
}
