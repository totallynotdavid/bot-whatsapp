import type { ICommandHandler } from "../command-handler.interface";
import type { CommandContext } from "../dto/command-context.dto";
import type { CommandResult } from "../dto/command-result.dto";
import type { CommandDependencies } from "../dto/command-dependencies.dto";
import { PhoneNumber } from "../../../domain/value-objects/phone-number.vo";
import { Rank } from "../../../domain/value-objects/rank.vo";
import { MESSAGES_ES } from "../../../shared/i18n/messages-es";
import { logger } from "../../../infrastructure/monitoring/logger";

export class AddPremiumHandler implements ICommandHandler {
  readonly metadata = {
    name: "addpremium",
    aliases: ["darpremium"],
    minRank: Rank.OWNER,
    description: "Otorga premium a un usuario",
    usage: "addpremium <días> (responde a un mensaje)",
  };

  constructor(private readonly deps: CommandDependencies) {}

  async execute(context: CommandContext): Promise<CommandResult> {
    const targetUserId =
      context.message.quotedUserId || context.message.mentions[0];

    if (!targetUserId) {
      return {
        type: "error",
        message: "Responde a un mensaje para dar premium.",
      };
    }

    const daysStr = context.args[0];
    if (!daysStr) {
      return {
        type: "error",
        message: "Especifica los días: /addpremium 30",
      };
    }

    const days = parseInt(daysStr, 10);
    if (Number.isNaN(days) || days <= 0) {
      return {
        type: "error",
        message: "Proporciona un número válido de días.",
      };
    }

    try {
      const targetPhone = PhoneNumber.create(targetUserId);
      await this.deps.userRepository.updateRank(
        targetPhone,
        Rank.PREMIUM,
        days
      );

      logger.info("Premium granted", {
        targetUser: targetPhone.toString(),
        days,
        grantedBy: context.user.phoneNumber.toString(),
      });

      return {
        type: "text",
        content: `${MESSAGES_ES.success.premiumAdded}\n🌟 Se otorgaron ${days} días de premium.`,
      };
    } catch (error) {
      logger.error("Failed to grant premium", error, {
        targetUser: targetUserId,
      });

      return {
        type: "error",
        message: "Error al actualizar el rango.",
      };
    }
  }
}
