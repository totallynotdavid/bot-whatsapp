import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../core/types";
import { Rank } from "../core/types";
import type { SpotifyAdapter } from "../adapters/spotify-adapter";
import type { WhatsAppSender } from "../adapters/whatsapp-sender";
import ffmpeg from "fluent-ffmpeg";
import { MediaStore } from "../stores/media-store";
import { withTimeout } from "../lib/timeout";
import { TIMEOUTS } from "../config";
import { retry } from "../lib/retry";
import { log } from "../lib/logger";

interface SpotifyDependencies {
  spotifyAdapter: SpotifyAdapter;
  sender: WhatsAppSender;
}

export class SpotifyCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "spot",
    aliases: ["spotify", "spt"],
    minRank: Rank.REGULAR,
    description: "Busca una canción en Spotify y envía su preview de 30s",
    usage: "spot <artista|cancion>",
    isHeavyOperation: false,
  };

  constructor(private readonly deps: SpotifyDependencies) {
    super();
  }

  protected async executeImpl(context: CommandContext): Promise<CommandResult> {
    const query = context.args.join(" ").trim();

    if (!query) {
      return {
        type: "text",
        content: `Uso: ${this.metadata.usage}`,
      };
    }

    const track = await this.deps.spotifyAdapter.searchTrack(query);

    if (!track) {
      return {
        type: "error",
        userMessage: "No encontré resultados en Spotify.",
      };
    }

    try {
      const resp = await retry(async () => {
        return withTimeout(async () => {
          return fetch(track.previewUrl);
        }, TIMEOUTS.EXTERNAL_API_MS);
      }, "spotify-download-preview");

      if (!resp.ok) {
        throw new Error(`Failed to download preview: ${resp.status}`);
      }

      const buffer = Buffer.from(await resp.arrayBuffer());
      const contentType = resp.headers.get("content-type") || "audio/mpeg";

      const ext = contentType.includes("ogg")
        ? "ogg"
        : contentType.includes("mpeg") || contentType.includes("mp3")
          ? "mp3"
          : "mp3";

      const filePath = await MediaStore.saveBuffer(buffer, ext);

      let outputPath = filePath;
      if (ext !== "ogg") {
        outputPath = MediaStore.getPath("ogg");
        await new Promise<void>((resolve, reject) => {
          ffmpeg(filePath)
            .audioCodec("libopus")
            .format("ogg")
            .audioBitrate("64k")
            .on("end", () => resolve())
            .on("error", (err: Error) => reject(err))
            .save(outputPath);
        });
      }

      setTimeout(() => {
        MediaStore.cleanup(filePath).catch(() => {});
        if (outputPath !== filePath) {
          MediaStore.cleanup(outputPath).catch(() => {});
        }
      }, 120000); // 2 minutes

      const artist = track.artists.join(", ");
      const title = `*${track.name}* de ${artist}`;

      await this.deps.sender.sendText(
        context.message.chatId,
        title,
        context.message.id
      );

      return {
        type: "media",
        filePath: outputPath,
        sendAudioAsVoice: true,
      };
    } catch (error) {
      log("error", "Spotify preview processing failed", {
        error: error instanceof Error ? error.message : String(error),
        query,
      });
      return {
        type: "error",
        userMessage: "No pude procesar la preview de Spotify.",
      };
    }
  }
}
