import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank } from "../../domain/user";
import type { CommandDeps } from "../command-deps";
import { MESSAGES } from "../../i18n/es";
import { log } from "../../lib/logging/logger";

export class RefreshCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "refresh",
    aliases: [],
    minRank: Rank.OWNER,
    description: "Limpia la caché de usuarios",
    usage: "refresh",
    isHeavyOperation: false,
  };

  constructor(private readonly deps: Pick<CommandDeps, "userService">) {
    super();
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    this.deps.userService.clearCache();

    log("info", "User cache refreshed", {
      requestedBy: context.user.phoneNumber,
    });

    return {
      type: "text",
      content: MESSAGES.success.cacheRefreshed,
    };
  }
}
