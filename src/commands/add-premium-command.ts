import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../core/types";
import { Rank, isPhoneNumberValid, normalizePhoneNumber } from "../core/types";
import type { UserStore } from "../stores/user-store";
import { MESSAGES } from "../i18n/es";
import { log } from "../lib/logger";

interface AddPremiumDependencies {
  userStore: UserStore;
  ownerPhone: string;
}

export class AddPremiumCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "addpremium",
    aliases: ["darpremium"],
    minRank: Rank.OWNER,
    description: "Otorga premium a un usuario",
    usage: "addpremium <días> (responde a un mensaje)",
    isHeavyOperation: false,
  };

  constructor(private readonly deps: AddPremiumDependencies) {
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

    const daysStr = context.args[0];

    if (!daysStr) {
      return {
        type: "error",
        userMessage: "Especifica los días: /addpremium 30",
      };
    }

    const days = parseInt(daysStr, 10);

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

      await this.deps.userStore.updateRank(targetPhone, Rank.PREMIUM, days);

      log("info", "Premium granted", {
        targetUser: targetPhone,
        days,
        grantedBy: context.user.phoneNumber,
      });

      return {
        type: "text",
        content: `${MESSAGES.success.premiumAdded}\n🌟 Se otorgaron ${days} días de premium.`,
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
