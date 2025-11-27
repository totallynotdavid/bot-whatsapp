import { Rank } from "../../../domain/value-objects/rank";
import type { CommandResult } from "../../dto/command-result.dto";
import type {
  CommandContext,
  CommandServices,
  ICommand,
} from "../command.interface";

export class KickCommand implements ICommand {
  readonly metadata = {
    name: "kick",
    aliases: ["ban", "expulsar"],
    minRank: Rank.ADMIN,
    description: "Expulsa a un usuario del grupo",
    usage: "kick (responde a un mensaje o menciona al usuario)",
  };

  async execute(
    ctx: CommandContext,
    services: CommandServices
  ): Promise<CommandResult> {
    if (!ctx.message.chat.isGroup) {
      return {
        type: "error",
        message: "Este comando solo funciona en grupos.",
      };
    }

    const targetId = ctx.message.quotedUserId || ctx.message.mentions[0];

    if (!targetId) {
      return {
        type: "error",
        message: "Responde a un mensaje o menciona a alguien para expulsarlo.",
      };
    }

    if (targetId === ctx.user.phoneNumber.toString()) {
      return {
        type: "text",
        content: "Buen intento. 😏",
      };
    }

    const success = await services.whatsappClient.removeParticipant(
      ctx.message.chat.id,
      targetId
    );

    if (success) {
      return {
        type: "text",
        content: "👋 Usuario expulsado.",
      };
    }

    return {
      type: "error",
      message: "No pude expulsar al usuario. Verifica que sea administrador.",
    };
  }
}
