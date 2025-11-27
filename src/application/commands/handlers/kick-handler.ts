import type { ICommandHandler } from "../command-handler.interface";
import type { CommandContext } from "../dto/command-context.dto";
import type { CommandResult } from "../dto/command-result.dto";
import type { CommandDependencies } from "../dto/command-dependencies.dto";
import { Rank } from "../../../domain/value-objects/rank.vo";
import { MESSAGES_ES } from "../../../shared/i18n/messages-es";

export class KickHandler implements ICommandHandler {
  readonly metadata = {
    name: "kick",
    aliases: ["ban", "expulsar"],
    minRank: Rank.ADMIN,
    description: "Expulsa a un usuario del grupo",
    usage: "kick (responde a un mensaje o menciona al usuario)",
  };

  constructor(private readonly deps: CommandDependencies) {}

  async execute(context: CommandContext): Promise<CommandResult> {
    if (!context.message.chat.isGroup) {
      return {
        type: "error",
        message: MESSAGES_ES.errors.groupOnly,
      };
    }

    const targetUserId =
      context.message.quotedUserId || context.message.mentions[0];

    if (!targetUserId) {
      return {
        type: "error",
        message: "Responde a un mensaje o menciona a alguien para expulsarlo.",
      };
    }

    if (targetUserId === context.user.phoneNumber.toString()) {
      return {
        type: "text",
        content: "Buen intento. 😏",
      };
    }

    const removed = await this.deps.messageSender.removeParticipant(
      context.message.chat.id,
      targetUserId
    );

    if (removed) {
      return {
        type: "text",
        content: MESSAGES_ES.success.userKicked,
      };
    }

    return {
      type: "error",
      message: "No pude expulsar al usuario. Verifica que sea administrador.",
    };
  }
}
