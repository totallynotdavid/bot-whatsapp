import type { Client, GroupChat } from "whatsapp-web.js";
import { MessageMedia } from "whatsapp-web.js";
import type { IMessageSender } from "./message-sender.interface";
import type { RetryPolicy } from "../resilience/retry-policy";
import type { TimeoutPolicy } from "../resilience/timeout-policy";
import { PERFORMANCE } from "../../config/constants";
import { logger } from "../monitoring/logger";

export class MessageSender implements IMessageSender {
  constructor(
    private readonly client: Client,
    private readonly retryPolicy: RetryPolicy,
    private readonly timeoutPolicy: TimeoutPolicy
  ) {}

  async sendText(
    chatId: string,
    text: string,
    replyToId?: string
  ): Promise<void> {
    await this.retryPolicy.execute(async () => {
      await this.timeoutPolicy.execute(async () => {
        const options: any = {};
        if (replyToId) {
          options.quotedMessageId = replyToId;
        }
        await this.client.sendMessage(chatId, text, options);
      }, PERFORMANCE.EXTERNAL_API_TIMEOUT_MS);
    }, "send-text");
  }

  async sendMedia(
    chatId: string,
    path: string,
    caption?: string,
    replyToId?: string
  ): Promise<void> {
    await this.retryPolicy.execute(async () => {
      await this.timeoutPolicy.execute(async () => {
        const media = MessageMedia.fromFilePath(path);
        const options: any = { caption };
        if (replyToId) {
          options.quotedMessageId = replyToId;
        }
        await this.client.sendMessage(chatId, media, options);
      }, PERFORMANCE.EXTERNAL_API_TIMEOUT_MS);
    }, "send-media");
  }

  async sendSticker(
    chatId: string,
    path: string,
    replyToId?: string
  ): Promise<void> {
    await this.retryPolicy.execute(async () => {
      await this.timeoutPolicy.execute(async () => {
        const media = MessageMedia.fromFilePath(path);
        const options: any = { sendMediaAsSticker: true };
        if (replyToId) {
          options.quotedMessageId = replyToId;
        }
        await this.client.sendMessage(chatId, media, options);
      }, PERFORMANCE.EXTERNAL_API_TIMEOUT_MS);
    }, "send-sticker");
  }

  async sendReaction(messageId: string, emoji: string): Promise<void> {
    try {
      const message = await this.client.getMessageById(messageId);
      await message.react(emoji);
    } catch (error) {
      logger.error("Failed to send reaction", error, { messageId, emoji });
    }
  }

  async removeParticipant(chatId: string, userId: string): Promise<boolean> {
    try {
      await this.retryPolicy.execute(async () => {
        const chat = await this.client.getChatById(chatId);
        if (!chat.isGroup) {
          throw new Error("Chat is not a group");
        }
        await (chat as GroupChat).removeParticipants([userId]);
      }, "remove-participant");

      return true;
    } catch (error) {
      logger.error("Failed to remove participant", error, { chatId, userId });
      return false;
    }
  }

  async downloadMedia(messageId: string): Promise<Buffer> {
    return this.retryPolicy.execute(async () => {
      return this.timeoutPolicy.execute(async () => {
        const message = await this.client.getMessageById(messageId);

        if (!message.hasMedia) {
          throw new Error("Message has no media");
        }

        const media = await message.downloadMedia();
        return Buffer.from(media.data, "base64");
      }, PERFORMANCE.EXTERNAL_API_TIMEOUT_MS);
    }, "download-media");
  }

  async getMediaInfo(
    messageId: string
  ): Promise<{ size: number; mimeType: string } | null> {
    try {
      return await this.timeoutPolicy.execute(async () => {
        const message = await this.client.getMessageById(messageId);

        if (!message.hasMedia) {
          return null;
        }

        const media = await message.downloadMedia();
        return {
          size: Buffer.from(media.data, "base64").length,
          mimeType: media.mimetype,
        };
      }, PERFORMANCE.EXTERNAL_API_TIMEOUT_MS);
    } catch {
      return null;
    }
  }
}
