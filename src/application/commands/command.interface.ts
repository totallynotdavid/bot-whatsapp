import type { CommandMetadata } from "../../domain/entities/command";
import type { Message } from "../../domain/entities/message";
import type { User } from "../../domain/entities/user";
import type { CommandResult } from "../dto/command-result.dto";

export interface CommandContext {
  readonly message: Message;
  readonly user: User;
  readonly args: string[];
}

export interface CommandServices {
  readonly userRepository: any;
  readonly queueService: any;
  readonly whatsappClient: any;
}

export interface ICommand {
  readonly metadata: CommandMetadata;
  execute(
    ctx: CommandContext,
    services: CommandServices
  ): Promise<CommandResult>;
}
