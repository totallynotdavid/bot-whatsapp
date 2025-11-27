import type { MediaJobResult } from "../application/interfaces/queue-service.interface";
import type { WhatsAppClient } from "./whatsapp/whatsapp.client";

export class MediaResponseService {
  constructor(private whatsappClient: WhatsAppClient) {}

  async sendResponse(
    chatId: string,
    messageId: string,
    result: MediaJobResult
  ): Promise<void> {
    if (!result.success || !result.outputPath) {
      await this.whatsappClient.sendText(
        chatId,
        `❌ Error: ${result.error}`,
        messageId
      );
      return;
    }

    switch (result.type) {
      case "sticker":
        await this.whatsappClient.sendSticker(
          chatId,
          result.outputPath,
          messageId
        );
        break;
      default:
        await this.whatsappClient.sendMedia(
          chatId,
          result.outputPath,
          result.caption,
          messageId
        );
        break;
    }
  }
}
