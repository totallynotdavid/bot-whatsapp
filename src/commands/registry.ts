import type { CommandHandler } from "./types";
import { CommandRouter } from "../core/command-router";
import { HelpCommand } from "./help-command";
import { StickerCommand } from "./sticker-command";
import { KickCommand } from "./kick-command";
import { AddPremiumCommand } from "./add-premium-command";
import { SpotifyCommand } from "./spotify-command";
import { DocsCommand } from "./docs-command";
import { SpotifyAdapter } from "../adapters/spotify-adapter";
import { config } from "../config";

export function buildCommandRegistry(dependencies: any): CommandRouter {
  const router = new CommandRouter();

  const commands: CommandHandler[] = [
    new HelpCommand(router),
    new StickerCommand(dependencies),
    new KickCommand(dependencies),
    new AddPremiumCommand(dependencies),
    new SpotifyCommand({
      spotifyAdapter: new SpotifyAdapter(
        config.SPOTIFY_CLIENT_ID,
        config.SPOTIFY_CLIENT_SECRET
      ),
      sender: dependencies.sender,
    }),
    new DocsCommand(
      dependencies.annasSearchAdapter,
      dependencies.searchStore,
      dependencies.queueAdapter
    ),
  ];

  for (const command of commands) {
    router.register(command);
  }

  return router;
}
