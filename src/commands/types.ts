import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../core/types";

export interface CommandHandler {
  readonly metadata: CommandMetadata;
  execute(context: CommandContext): Promise<CommandResult>;
}

export interface CommandDependencies {
  readonly userStore: any;
  readonly queueAdapter: any;
  readonly sender: any;
  readonly ownerPhone: string;
}
