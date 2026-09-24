import ffmpeg from "fluent-ffmpeg";
import { jobPayloadSchemas } from "../../../domain/job";
import type { MessageSender } from "../../../application/ports/message-sender";
import type { TempStore } from "../../../application/ports/temp-store";
import type { TrackSearch } from "../../../application/ports/track-search";
import { JobRejectedError, type JobDefinition } from "../job-definition";

export interface SpotifyJobDeps {
  readonly spotify: TrackSearch;
  readonly sender: Pick<MessageSender, "sendText" | "sendMedia">;
  readonly tempFiles: Pick<TempStore, "saveBuffer" | "getPath" | "cleanup">;
}

export function spotifyJob({
  spotify,
  sender,
  tempFiles,
}: SpotifyJobDeps): JobDefinition<"spotify"> {
  return {
    name: "spotify",
    schema: jobPayloadSchemas.spotify,
    limits: { concurrency: 5, timeoutMs: 120_000, attempts: 3 },
    failureMessage: "No se pudo procesar la preview de Spotify",

    async run({ chatId, messageId, query }, signal) {
      // Command checks credentials at enqueue time; config may have changed by run time.
      if (!spotify.isConfigured()) {
        throw new JobRejectedError("No se pudo procesar la preview de Spotify");
      }

      const track = await spotify.searchTrack(query, signal);
      if (!track) {
        throw new JobRejectedError("No se encontró la canción en Spotify");
      }

      const response = await fetch(track.previewUrl, { signal });
      if (!response.ok) {
        throw new Error(`Failed to download preview: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const isOgg = (response.headers.get("content-type") ?? "").includes(
        "ogg"
      );
      const inputPath = await tempFiles.saveBuffer(
        buffer,
        isOgg ? "ogg" : "mp3"
      );
      const voicePath = isOgg ? inputPath : tempFiles.getPath("ogg");
      try {
        if (!isOgg) await convertToOgg(inputPath, voicePath);
        signal.throwIfAborted();
        await sender.sendText(
          chatId,
          `*${track.name}* de ${track.artists.join(", ")}`,
          messageId
        );
        signal.throwIfAborted();
        await sender.sendMedia(chatId, voicePath, undefined, messageId, true);
      } finally {
        await tempFiles.cleanup(inputPath);
        await tempFiles.cleanup(voicePath);
      }
    },
  };
}

function convertToOgg(inputPath: string, outputPath: string): Promise<void> {
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
