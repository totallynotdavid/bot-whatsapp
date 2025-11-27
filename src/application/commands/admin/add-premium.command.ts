import type { ICommand } from "../command.interface";
import type { CommandContext, CommandServices } from "../command.interface";
import type { CommandResult } from "../../dto/command-result.dto";
import { Rank } from "../../../domain/value-objects/rank";
import { PhoneNumber } from "../../../domain/value-objects/phone-number";

export class AddPremiumCommand implements ICommand {
  readonly metadata = {
    name: "addpremium",
    aliases: ["darpremium"],
    minRank: Rank.OWNER,
    description: "Otorga premium a un usuario",
    usage: "addpremium <días> (responde a un mensaje)",
  };

  async execute(
    ctx: CommandContext,
    services: CommandServices
  ): Promise<CommandResult> {
    const targetId = ctx.message.quotedUserId || ctx.message.mentions[0];

    if (!targetId) {
      return {
        type: "error",
        message: "Responde a un mensaje para dar premium.",
      };
    }

    const daysStr = ctx.args[0];
    if (!daysStr) {
      return {
        type: "error",
        message: "Especifica los días: /addpremium 30",
      };
    }

    const days = parseInt(daysStr, 10);
    if (isNaN(days) || days <= 0) {
      return {
        type: "error",
        message: "Proporciona un número válido de días.",
      };
    }

    try {
      const phone = PhoneNumber.create(targetId);
      await services.userRepository.setRank(phone, Rank.PREMIUM, days);

      return {
        type: "text",
        content: `🌟 Se otorgaron ${days} días de premium.`,
      };
    } catch (err) {
      return {
        type: "error",
        message: "Error al actualizar el rango.",
      };
    }
  }
}
