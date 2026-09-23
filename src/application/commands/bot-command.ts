import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank } from "../../domain/user";
import type { GroupRepository } from "../../infrastructure/database/repositories/group-repository";
import { MESSAGES } from "../../i18n/es";
import { log } from "../../lib/logging/logger";

export class BotCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "bot",
    aliases: [],
    minRank: Rank.PREMIUM,
    description: "Activa o desactiva el bot en el grupo",
    usage: "bot <on|off>",
    isHeavyOperation: false,
  };

  constructor(private readonly groupRepo: GroupRepository) {
    super();
  }

  protected async executeImpl(context: CommandContext): Promise<CommandResult> {
    if (!this.requiresGroup(context)) {
      return {
        type: "error",
        userMessage: MESSAGES.errors.groupOnly,
      };
    }

    const action = context.args[0]?.toLowerCase();

    if (action !== "on" && action !== "off") {
      return {
        type: "error",
        userMessage: MESSAGES.errors.botInvalidAction,
      };
    }

    const chatId = context.message.chatId;
    const group = await this.groupRepo.findByGroupId(chatId);

    if (!group) {
      return {
        type: "error",
        userMessage: MESSAGES.errors.groupNotRegistered,
      };
    }

    const desiredActive = action === "on";

    if (group.isActive === desiredActive) {
      return {
        type: "text",
        content: desiredActive
          ? MESSAGES.info.botAlreadyOn
          : MESSAGES.info.botAlreadyOff,
      };
    }

    try {
      await this.groupRepo.setActive(chatId, desiredActive);

      return {
        type: "text",
        content: desiredActive
          ? MESSAGES.success.botOn
          : MESSAGES.success.botOff,
      };
    } catch (error) {
      log("error", "Failed to toggle bot status", {
        chatId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        type: "error",
        userMessage: MESSAGES.errors.databaseError,
      };
    }
  }
}
