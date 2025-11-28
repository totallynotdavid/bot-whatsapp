import type { Client, GroupChat } from "whatsapp-web.js";
import { MessageMedia } from "whatsapp-web.js";
import { retry } from "../lib/retry";
import { withTimeout } from "../lib/timeout";
import { TIMEOUTS } from "../config";
import { log } from "../lib/logger";

export class WhatsAppSender {
  constructor(private readonly client: Client) {}

  async sendText(
    chatId: string,
    text: string,
    replyToId?: string
  ): Promise<void> {
    await retry(async () => {
      await withTimeout(async () => {
        const options: any = {};
        if (replyToId) {
          options.quotedMessageId = replyToId;
        }
        await this.client.sendMessage(chatId, text, options);
      }, TIMEOUTS.EXTERNAL_API_MS);
    }, "send-text");
  }

  async sendMedia(
    chatId: string,
    filePath: string,
    caption?: string,
    replyToId?: string,
    sendAudioAsVoice?: boolean
  ): Promise<void> {
    await retry(async () => {
      await withTimeout(async () => {
        const media = MessageMedia.fromFilePath(filePath);
        const options: any = { caption };
        if (replyToId) {
          options.quotedMessageId = replyToId;
        }
        if (sendAudioAsVoice) {
          options.sendAudioAsVoice = true;
        }
        await this.client.sendMessage(chatId, media, options);
      }, TIMEOUTS.EXTERNAL_API_MS);
    }, "send-media");
  }

  async sendSticker(
    chatId: string,
    filePath: string,
    replyToId?: string
  ): Promise<void> {
    await retry(async () => {
      await withTimeout(async () => {
        const media = MessageMedia.fromFilePath(filePath);
        const options: any = { sendMediaAsSticker: true };
        if (replyToId) {
          options.quotedMessageId = replyToId;
        }
        await this.client.sendMessage(chatId, media, options);
      }, TIMEOUTS.EXTERNAL_API_MS);
    }, "send-sticker");
  }

  async sendReaction(messageId: string, emoji: string): Promise<void> {
    try {
      const message = await this.client.getMessageById(messageId);
      await message.react(emoji);
    } catch (error) {
      log("error", "Failed to send reaction", {
        messageId,
        emoji,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async removeParticipant(chatId: string, userId: string): Promise<boolean> {
    try {
      await retry(async () => {
        const chat = await this.client.getChatById(chatId);
        if (!chat.isGroup) {
          throw new Error("Chat is not a group");
        }
        await (chat as GroupChat).removeParticipants([userId]);
      }, "remove-participant");

      return true;
    } catch (error) {
      log("error", "Failed to remove participant", {
        chatId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async downloadMedia(messageId: string): Promise<Buffer> {
    return retry(async () => {
      return withTimeout(async () => {
        const message = await this.client.getMessageById(messageId);

        if (!message.hasMedia) {
          throw new Error("Message has no media");
        }

        const media = await message.downloadMedia();
        return Buffer.from(media.data, "base64");
      }, TIMEOUTS.EXTERNAL_API_MS);
    }, "download-media");
  }

  async getMediaInfo(
    messageId: string
  ): Promise<{ size: number; mimeType: string } | null> {
    try {
      return await withTimeout(async () => {
        const message = await this.client.getMessageById(messageId);

        if (!message.hasMedia) {
          return null;
        }

        const media = await message.downloadMedia();
        return {
          size: Buffer.from(media.data, "base64").length,
          mimeType: media.mimetype,
        };
      }, TIMEOUTS.EXTERNAL_API_MS);
    } catch {
      return null;
    }
  }
}
