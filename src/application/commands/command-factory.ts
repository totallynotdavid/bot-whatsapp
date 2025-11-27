import type { ICommandHandler } from "./command-handler.interface";
import type { CommandRegistry } from "./command-registry";
import type { CommandDependencies } from "./dto/command-dependencies.dto";
import type { IUserRepository } from "../../domain/repositories/user-repository.interface";
import type { IQueueClient } from "../../infrastructure/queue/queue-client.interface";
import type { IMessageSender } from "../../infrastructure/whatsapp/message-sender.interface";
import type { IMediaValidator } from "../../infrastructure/whatsapp/media-validator.interface";
import type { PhoneNumber } from "../../domain/value-objects/phone-number.vo";

type CommandHandlerConstructor = new (
  deps: CommandDependencies,
  registry?: CommandRegistry
) => ICommandHandler;

export class CommandFactory {
  private readonly dependencies: CommandDependencies;

  constructor(
    private readonly registry: CommandRegistry,
    userRepository: IUserRepository,
    queueClient: IQueueClient,
    messageSender: IMessageSender,
    mediaValidator: IMediaValidator,
    ownerPhone: PhoneNumber
  ) {
    this.dependencies = {
      userRepository,
      queueClient,
      messageSender,
      mediaValidator,
      ownerPhone,
    };
  }

  registerCommand(HandlerClass: CommandHandlerConstructor): void {
    const handler = new HandlerClass(this.dependencies, this.registry);
    this.registry.register(handler);
  }
}
