import type { Message } from "../../../domain/models/message.model";
import type { User } from "../../../domain/models/user.model";

export interface CommandContext {
  readonly message: Message;
  readonly user: User;
  readonly args: string[];
}
