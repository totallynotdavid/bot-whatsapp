import { logger } from "../../shared/logger";
import type { IWhatsAppClient } from "../interfaces/whatsapp-client.interface";

export class AcknowledgeMessageUseCase {
  constructor(private whatsappClient: IWhatsAppClient) {}

  async execute(messageId: string): Promise<void> {
    const start = Date.now();

    try {
      await this.whatsappClient.sendReaction(messageId, "⏳");

      const duration = Date.now() - start;

      if (duration > 500) {
        logger.warn("Acknowledgment exceeded 500ms threshold", {
          messageId,
          duration,
        });
      }
    } catch (error) {
      logger.error("Failed to acknowledge message", error, { messageId });
    }
  }

  async complete(messageId: string, success: boolean): Promise<void> {
    try {
      await this.whatsappClient.sendReaction(messageId, success ? "" : "❌");
    } catch (error) {
      logger.error("Failed to complete acknowledgment", error, { messageId });
    }
  }
}
