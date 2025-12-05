import type { DocsJobData, JobResult } from "../../../domain/job";
import { createSuccessResult, createFailureResult } from "../../../domain/job";
import type { AnnasArchiveClient } from "../../external/annas-archive-client";
import type { TempFileStore } from "../../storage/temp-file-store";
import { log } from "../../../lib/logging/logger";

export class DocsProcessor {
  constructor(
    private readonly annasClient: AnnasArchiveClient,
    private readonly tempFileStore: TempFileStore
  ) {}

  async process(jobData: DocsJobData): Promise<JobResult> {
    try {
      log("info", "Processing docs job", {
        messageId: jobData.messageId,
        title: jobData.title,
      });

      const buffer = await this.annasClient.downloadBook(jobData.mirror);

      if (!buffer) {
        return createFailureResult("No se pudo descargar el documento");
      }

      const outputPath = await this.tempFileStore.saveBuffer(
        buffer,
        jobData.format
      );

      const caption = `${jobData.title}${jobData.author ? ` por ${jobData.author}` : ""}`;

      log("info", "Document downloaded successfully", {
        messageId: jobData.messageId,
        outputPath,
        format: jobData.format,
      });

      return createSuccessResult(outputPath, "media", caption);
    } catch (error) {
      log("error", "Docs processing failed", {
        messageId: jobData.messageId,
        error: error instanceof Error ? error.message : String(error),
      });

      return createFailureResult("Error al descargar el documento");
    }
  }
}
