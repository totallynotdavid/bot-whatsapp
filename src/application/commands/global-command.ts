import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank } from "../../domain/user";
import { toWhatsAppId } from "../../domain/message";
import type { CommandDeps } from "../command-deps";
import { GLOBAL_BROADCAST_DELAY_MS } from "../../config/constants";
import { MESSAGES, formatGlobalBroadcastResult } from "../../i18n/es";
import { log } from "../../lib/logging/logger";

export class GlobalCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "global",
    aliases: [],
    minRank: Rank.OWNER,
    description: "Envía un mensaje a todos los usuarios premium activos",
    usage: "global <mensaje>",
    isHeavyOperation: false,
    requiresActiveGroup: false,
  };

  constructor(private readonly deps: Pick<CommandDeps, "users" | "sender">) {
    super();
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const text = context.args.join(" ");

    if (!text) {
      return {
        type: "error",
        userMessage: MESSAGES.errors.globalMessageRequired,
      };
    }

    const users = await this.deps.users.findAllActivePremiumUsers();

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i]!;

      try {
        await this.deps.sender.sendText(toWhatsAppId(user.phoneNumber), text);
        succeeded++;
      } catch (error) {
        failed++;
        log("error", "Failed to send global broadcast message", {
          phoneNumber: user.phoneNumber,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const isLastRecipient = i === users.length - 1;
      if (!isLastRecipient) {
        await new Promise((resolve) =>
          setTimeout(resolve, GLOBAL_BROADCAST_DELAY_MS)
        );
      }
    }

    log("info", "Global broadcast finished", {
      requestedBy: context.user.phoneNumber,
      succeeded,
      failed,
    });

    return {
      type: "text",
      content: formatGlobalBroadcastResult(succeeded, failed),
    };
  }
}
