import type { Message } from "./message";

// "failed" means the command could not do what was asked, and said so in its
// reply. It is not an error to raise: the handler only withholds its
// acknowledgement.
export type CommandOutcome = "completed" | "failed";

export interface CommandReply {
  readonly text: string;
  readonly outcome: CommandOutcome;
}

export interface Command {
  readonly name: string;
  // Replies through the sender itself. A rejection means the command could
  // not even reply and is logged as an error.
  run(message: Message): Promise<CommandOutcome>;
}
