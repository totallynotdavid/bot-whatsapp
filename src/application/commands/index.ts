import type { CommandHandler } from "../../domain/command";
import type { CommandDeps } from "../command-deps";
import { AddGroupCommand } from "./addgroup-command";
import { BotCommand } from "./bot-command";
import { DocsCommand } from "./docs-command";
import { EditCommand } from "./edit-command";
import { GlobalCommand } from "./global-command";
import { HelpCommand } from "./help-command";
import { KickCommand } from "./kick-command";
import { PremiumCommand } from "./premium-command";
import { RefreshCommand } from "./refresh-command";
import { SpotifyCommand } from "./spotify-command";
import { StickerCommand } from "./sticker-command";
import { SubscriptionCommand } from "./subscription-command";

export function createCommands(deps: CommandDeps): CommandHandler[] {
  return [
    new HelpCommand(deps),
    new StickerCommand(deps),
    new KickCommand(deps),
    new PremiumCommand(deps),
    new SpotifyCommand(deps),
    new DocsCommand(deps),
    new AddGroupCommand(deps),
    new BotCommand(deps),
    new SubscriptionCommand(deps),
    new RefreshCommand(deps),
    new GlobalCommand(deps),
    new EditCommand(deps),
  ];
}
