import type {
  CommandHandler,
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { MESSAGES } from "../../i18n/es";
import { log } from "../../lib/logging/logger";

export abstract class BaseCommand implements CommandHandler {
  abstract readonly metadata: CommandMetadata;

  async execute(context: CommandContext): Promise<CommandResult> {
    try {
      return await this.executeImpl(context);
    } catch (error) {
      log("error", "Command failed", {
        command: this.metadata.name,
        messageId: context.message.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        type: "error",
        userMessage: MESSAGES.errors.internalError,
      };
    }
  }

  protected abstract executeImpl(
    context: CommandContext
  ): Promise<CommandResult>;

  protected requiresMedia(context: CommandContext): boolean {
    return (
      context.message.hasMedia || context.message.quotedMessageId !== undefined
    );
  }

  protected requiresGroup(context: CommandContext): boolean {
    return context.message.isGroup;
  }

  protected getTargetUserId(context: CommandContext): string | null {
    return (
      context.message.quotedUserId ||
      context.message.mentionedUserIds[0] ||
      null
    );
  }
}
