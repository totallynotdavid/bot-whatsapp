import type { CommandHandler } from "./types";
import { CommandRouter } from "../core/command-router";
import { HelpCommand } from "./help-command";
import { StickerCommand } from "./sticker-command";
import { KickCommand } from "./kick-command";
import { AddPremiumCommand } from "./add-premium-command";

export function buildCommandRegistry(dependencies: any): CommandRouter {
  const router = new CommandRouter();

  const commands: CommandHandler[] = [
    new HelpCommand(router),
    new StickerCommand(dependencies),
    new KickCommand(dependencies),
    new AddPremiumCommand(dependencies),
  ];

  for (const command of commands) {
    router.register(command);
  }

  return router;
}
