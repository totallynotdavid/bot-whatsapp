import type { IUserRepository } from "../../domain/repositories/user.repository.interface";
import type { IQueueService } from "./queue-service.interface";
import type { IWhatsAppClient } from "./whatsapp-client.interface";

export interface ICommandServices {
  readonly userRepository: IUserRepository;
  readonly queueService: IQueueService;
  readonly whatsappClient: IWhatsAppClient;
}
