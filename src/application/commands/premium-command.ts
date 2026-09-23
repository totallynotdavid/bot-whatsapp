import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank } from "../../domain/user";
import { isPhoneNumberValid, normalizePhoneNumber } from "../../domain/message";
import type { UserService } from "../services/user-service";
import { formatPremiumGranted } from "../../i18n/es";
import { log } from "../../lib/logging/logger";

export class PremiumCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "addpremium",
    aliases: ["darpremium", "premium"],
    minRank: Rank.OWNER,
    description: "Otorga premium a un usuario",
    usage: "addpremium <días> (responde a un mensaje)",
    isHeavyOperation: false,
  };

  constructor(private readonly userService: UserService) {
    super();
  }

  protected async executeImpl(context: CommandContext): Promise<CommandResult> {
    const targetUserId = this.getTargetUserId(context);

    if (!targetUserId) {
      return {
        type: "error",
        userMessage: "Responde a un mensaje para dar premium.",
      };
    }

    const daysArg = context.args[0];

    if (!daysArg) {
      return {
        type: "error",
        userMessage: "Especifica los días: /addpremium 30",
      };
    }

    const days = parseInt(daysArg, 10);

    if (Number.isNaN(days) || days <= 0) {
      return {
        type: "error",
        userMessage: "Proporciona un número válido de días.",
      };
    }

    try {
      const targetPhone = normalizePhoneNumber(targetUserId);

      if (!isPhoneNumberValid(targetPhone)) {
        return {
          type: "error",
          userMessage: "Número de teléfono inválido.",
        };
      }

      await this.userService.grantPremium(targetPhone, days);

      log("info", "Premium granted", {
        targetUser: targetPhone,
        days,
        grantedBy: context.user.phoneNumber,
      });

      return {
        type: "text",
        content: formatPremiumGranted(days),
      };
    } catch (error) {
      log("error", "Failed to grant premium", {
        targetUser: targetUserId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        type: "error",
        userMessage: "Error al actualizar el rango.",
      };
    }
  }
}
