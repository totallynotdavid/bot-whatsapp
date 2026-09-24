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

export class KickCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "kick",
    aliases: ["ban", "expulsar"],
    minRank: Rank.REGULAR,
    description: "Expulsa a un usuario del grupo",
    usage: "kick (responde o menciona al usuario)",
    isHeavyOperation: false,
    // Who may kick is decided by WhatsApp group roles, not by bot
    // subscriptions.
    requiresActiveGroup: false,
  };

  constructor(private readonly deps: Pick<CommandDeps, "sender">) {
    super();
  }

  protected async executeImpl(context: CommandContext): Promise<CommandResult> {
    if (!this.requiresGroup(context)) {
      return {
        type: "error",
        userMessage: MESSAGES.errors.groupOnly,
      };
    }

    const { chatId } = context.message;

    const isOwner = context.user.rank === Rank.OWNER;
    if (
      !isOwner &&
      !(await this.deps.sender.isGroupAdmin(chatId, context.user.phoneNumber))
    ) {
      return {
        type: "error",
        userMessage: MESSAGES.errors.kickAdminOnly,
      };
    }

    const targetUserId = this.getTargetUserId(context);

    if (!targetUserId) {
      return {
        type: "error",
        userMessage:
          "Responde a un mensaje o menciona a alguien para expulsarlo.",
      };
    }

    if (targetUserId === context.user.phoneNumber) {
      return {
        type: "text",
        content: "Buen intento. 😏",
      };
    }

    try {
      await this.deps.sender.removeParticipant(chatId, targetUserId);
    } catch (error) {
      log("error", "Failed to remove participant", {
        chatId,
        userId: targetUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        type: "error",
        userMessage:
          "No pude expulsar al usuario. Verifica que el bot sea administrador.",
      };
    }

    return {
      type: "text",
      content: MESSAGES.success.userKicked,
    };
  }
}
