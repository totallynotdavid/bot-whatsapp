import type { Message } from "../../domain/message";

export interface EventLog {
  commandUsed(entry: {
    commandId: string;
    commandName: string;
    message: Message;
    at: Date;
  }): Promise<void>;

  failed(entry: { message: Message; error: unknown; at: Date }): Promise<void>;
}
