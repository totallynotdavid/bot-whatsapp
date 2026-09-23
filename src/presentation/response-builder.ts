import type { CommandResult } from "../domain/command";
import type { Message } from "../domain/message";
import type { WhatsAppSender } from "../infrastructure/whatsapp/sender";
import { log } from "../lib/logging/logger";

export class ResponseBuilder {
  constructor(private readonly sender: WhatsAppSender) {}

  async send(result: CommandResult, originalMessage: Message): Promise<void> {
    try {
      switch (result.type) {
        case "text":
          await this.sender.sendText(
            originalMessage.chatId,
            result.content,
            originalMessage.id
          );
          break;

        case "media":
          await this.sender.sendMedia(
            originalMessage.chatId,
            result.filePath,
            result.caption,
            originalMessage.id,
            result.sendAudioAsVoice
          );
          break;

        case "sticker":
          await this.sender.sendSticker(
            originalMessage.chatId,
            result.filePath,
            originalMessage.id
          );
          break;

        case "queued":
          await this.sender.sendText(
            originalMessage.chatId,
            result.queueMessage,
            originalMessage.id
          );
          break;

        case "error":
          await this.sender.sendText(
            originalMessage.chatId,
            `❌ ${result.userMessage}`,
            originalMessage.id
          );
          break;

        case "none":
          break;
      }
    } catch (error) {
      log("error", "Failed to send response", {
        messageId: originalMessage.id,
        resultType: result.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
