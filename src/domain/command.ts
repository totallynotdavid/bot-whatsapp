import type { Rank } from "./user";
import type { User } from "./user";
import type { Message } from "./message";

export interface CommandMetadata {
  readonly name: string;
  readonly aliases: string[];
  readonly minRank: Rank;
  readonly description: string;
  readonly usage: string;
  readonly isHeavyOperation: boolean;
}

export interface CommandContext {
  readonly message: Message;
  readonly user: User;
  readonly args: string[];
}

export type CommandResult =
  | { type: "text"; content: string }
  | {
      type: "media";
      filePath: string;
      caption?: string;
      sendAudioAsVoice?: boolean;
    }
  | { type: "sticker"; filePath: string }
  | { type: "queued"; queueMessage: string }
  | { type: "error"; userMessage: string }
  | { type: "none" };

export interface CommandHandler {
  readonly metadata: CommandMetadata;
  execute(context: CommandContext): Promise<CommandResult>;
}
