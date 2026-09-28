import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank } from "../../domain/user";
import type { CommandDeps } from "../command-deps";
import { MESSAGES } from "../../i18n/es";

export class SpotifyCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "spot",
    aliases: ["spotify", "spt"],
    minRank: Rank.REGULAR,
    description: "Busca una canción en Spotify y envía su preview de 30s",
    usage: "spot <artista|cancion>",
    isHeavyOperation: true,
  };

  constructor(private readonly deps: Pick<CommandDeps, "jobs" | "tracks">) {
    super();
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const query = context.args.join(" ").trim();

    if (!query) {
      return {
        type: "text",
        content: `Uso: /${this.metadata.usage}`,
      };
    }

    if (!this.deps.tracks.isConfigured()) {
      return { type: "error", userMessage: MESSAGES.errors.spotUnavailable };
    }

    await this.deps.jobs.enqueue("spotify", {
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
