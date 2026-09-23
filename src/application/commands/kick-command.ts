import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank } from "../../domain/user";
import type { WhatsAppSender } from "../../infrastructure/whatsapp/sender";
import { MESSAGES } from "../../i18n/es";

export class KickCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "kick",
    aliases: ["ban", "expulsar"],
    minRank: Rank.ADMIN,
    description: "Expulsa a un usuario del grupo",
    usage: "kick (responde o menciona al usuario)",
    isHeavyOperation: false,
  };

  constructor(private readonly sender: WhatsAppSender) {
    super();
  }

  protected async executeImpl(context: CommandContext): Promise<CommandResult> {
    if (!this.requiresGroup(context)) {
      return {
        type: "error",
        userMessage: MESSAGES.errors.groupOnly,
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

    const removed = await this.sender.removeParticipant(
      context.message.chatId,
      targetUserId
    );

    if (removed) {
      return {
        type: "text",
        content: MESSAGES.success.userKicked,
      };
    }

    return {
      type: "error",
      userMessage:
        "No pude expulsar al usuario. Verifica que el bot sea administrador.",
    };
  }
}
