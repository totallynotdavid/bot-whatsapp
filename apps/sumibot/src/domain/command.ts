import type { Message } from "./message";

export interface Command {
  readonly name: string;
  // Replies through the sender itself. A rejection means the command could
  // not finish and is logged as an error.
  run(message: Message): Promise<void>;
}
