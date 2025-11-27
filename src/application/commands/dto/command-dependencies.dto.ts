import type { IUserRepository } from "../../../domain/repositories/user-repository.interface";
import type { IQueueClient } from "../../../infrastructure/queue/queue-client.interface";
import type { IMessageSender } from "../../../infrastructure/whatsapp/message-sender.interface";
import type { IMediaValidator } from "../../../infrastructure/whatsapp/media-validator.interface";
import type { PhoneNumber } from "../../../domain/value-objects/phone-number.vo";

export interface CommandDependencies {
  readonly userRepository: IUserRepository;
  readonly queueClient: IQueueClient;
  readonly messageSender: IMessageSender;
  readonly mediaValidator: IMediaValidator;
  readonly ownerPhone: PhoneNumber;
}
