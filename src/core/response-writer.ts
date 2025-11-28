import type { CommandResult, Message } from "./types";
import type { WhatsAppSender } from "../adapters/whatsapp-sender";
import { log } from "../lib/logger";

export class ResponseWriter {
  constructor(private readonly sender: WhatsAppSender) {}

  async writeResponse(
    result: CommandResult,
    originalMessage: Message
  ): Promise<void> {
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
            originalMessage.id
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
      log("error", "Failed to write response", {
        messageId: originalMessage.id,
        resultType: result.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async acknowledgeMessage(messageId: string): Promise<void> {
    try {
      await this.sender.sendReaction(messageId, "⏳");
    } catch (error) {
      log("error", "Failed to acknowledge message", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async clearReaction(messageId: string): Promise<void> {
    try {
      await this.sender.sendReaction(messageId, "");
    } catch (error) {
      log("error", "Failed to clear reaction", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async markError(messageId: string): Promise<void> {
    try {
      await this.sender.sendReaction(messageId, "❌");
    } catch (error) {
      log("error", "Failed to mark error", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
