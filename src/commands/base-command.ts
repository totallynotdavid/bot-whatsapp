import type { CommandHandler } from "./types";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../core/types";

export abstract class BaseCommand implements CommandHandler {
  abstract readonly metadata: CommandMetadata;

  async execute(context: CommandContext): Promise<CommandResult> {
    try {
      return await this.executeImpl(context);
    } catch (_error) {
      return {
        type: "error",
        userMessage: "Ocurrió un error al procesar el comando.",
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
