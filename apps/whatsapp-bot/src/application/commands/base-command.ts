import type {
  CommandHandler,
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";

export abstract class BaseCommand implements CommandHandler {
  abstract readonly metadata: CommandMetadata;

  abstract execute(context: CommandContext): Promise<CommandResult>;

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
