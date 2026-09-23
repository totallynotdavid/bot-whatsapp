import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank } from "../../domain/user";
import type { JobScheduler } from "../services/job-scheduler";
import type { SpotifyClient } from "../../infrastructure/external/spotify-client";

export class SpotifyCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "spot",
    aliases: ["spotify", "spt"],
    minRank: Rank.REGULAR,
    description: "Busca una canción en Spotify y envía su preview de 30s",
    usage: "spot <artista|cancion>",
    isHeavyOperation: true,
  };

  constructor(
    private readonly jobScheduler: JobScheduler,
    private readonly spotify: Pick<SpotifyClient, "isConfigured">
  ) {
    super();
  }

  protected async executeImpl(context: CommandContext): Promise<CommandResult> {
    const query = context.args.join(" ").trim();

    if (!query) {
      return {
        type: "text",
        content: `Uso: /${this.metadata.usage}`,
      };
    }

    if (!this.spotify.isConfigured()) {
      return {
        type: "error",
        userMessage: "El comando /spot no está disponible en este momento.",
      };
    }

    await this.jobScheduler.enqueue("spotify", {
      messageId: context.message.id,
      chatId: context.message.chatId,
      userId: context.user.phoneNumber,
      query,
    });

    return {
      type: "queued",
      queueMessage: "🎵 Buscando en Spotify...",
    };
  }
}
