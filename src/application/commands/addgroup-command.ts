import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank } from "../../domain/user";
import type { CommandDeps } from "../command-deps";
import { GroupAlreadyRegisteredError } from "../ports/group-store";
import { MESSAGES } from "../../i18n/es";
import { log } from "../../lib/logging/logger";

export class AddGroupCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "addgroup",
    aliases: [],
    minRank: Rank.PREMIUM,
    description: "Registra el grupo actual bajo tu número",
    usage: "addgroup",
    isHeavyOperation: false,
  };

  constructor(private readonly deps: Pick<CommandDeps, "groups">) {
    super();
  }

  protected async executeImpl(context: CommandContext): Promise<CommandResult> {
    if (!this.requiresGroup(context)) {
      return {
        type: "error",
        userMessage: MESSAGES.errors.groupOnly,
      };
    }

    const { chatId, groupName } = context.message;

    if (!groupName) {
      return {
        type: "error",
        userMessage: MESSAGES.errors.internalError,
      };
    }

    try {
      await this.deps.groups.registerOrReactivate(
        chatId,
        groupName,
        context.user.phoneNumber
      );

      return {
        type: "text",
        content: MESSAGES.success.groupRegistered,
      };
    } catch (error) {
      if (error instanceof GroupAlreadyRegisteredError) {
        return {
          type: "error",
          userMessage: MESSAGES.errors.groupAlreadyRegistered,
        };
      }

      log("error", "Failed to register group", {
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
