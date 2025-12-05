import ffmpeg from "fluent-ffmpeg";
import type { SpotifyJobData, JobResult } from "../../../domain/job";
import { createSuccessResult, createFailureResult } from "../../../domain/job";
import type { SpotifyClient } from "../../external/spotify-client";
import type { TempFileStore } from "../../storage/temp-file-store";
import { retry } from "../../../lib/resilience/retry";
import { withTimeout } from "../../../lib/resilience/timeout";
import { TIMEOUTS } from "../../../config/constants";
import { log } from "../../../lib/logging/logger";

export class SpotifyProcessor {
  constructor(
    private readonly spotifyClient: SpotifyClient,
    private readonly tempFileStore: TempFileStore
  ) {}

  async process(jobData: SpotifyJobData): Promise<JobResult> {
    try {
      log("info", "Processing Spotify job", {
        messageId: jobData.messageId,
        query: jobData.query,
      });

      const track = await this.spotifyClient.searchTrack(jobData.query);

      if (!track) {
        return createFailureResult("No se encontró la canción en Spotify");
      }

      const response = await retry(async () => {
        return withTimeout(
          async () => {
            return fetch(track.previewUrl);
          },
          TIMEOUTS.EXTERNAL_API_MS,
          "spotify-download-preview"
        );
      }, "spotify-download-preview");

      if (!response.ok) {
        throw new Error(`Failed to download preview: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") || "audio/mpeg";

      const extension = contentType.includes("ogg") ? "ogg" : "mp3";
      const inputPath = await this.tempFileStore.saveBuffer(buffer, extension);

      let outputPath = inputPath;
      if (extension !== "ogg") {
        outputPath = this.tempFileStore.getPath("ogg");
        await this.convertToOgg(inputPath, outputPath);
      }

      const artist = track.artists.join(", ");
      const caption = `*${track.name}* de ${artist}`;

      log("info", "Spotify preview processed successfully", {
        messageId: jobData.messageId,
        trackName: track.name,
      });

      return createSuccessResult(outputPath, "audio", caption);
    } catch (error) {
      log("error", "Spotify processing failed", {
        messageId: jobData.messageId,
        error: error instanceof Error ? error.message : String(error),
      });

      return createFailureResult("No se pudo procesar la preview de Spotify");
    }
  }

  private async convertToOgg(
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec("libopus")
        .format("ogg")
        .audioBitrate("64k")
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .save(outputPath);
    });
  }
}
