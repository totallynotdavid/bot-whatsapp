import type { Client, GroupChat } from "whatsapp-web.js";
import { MessageMedia } from "whatsapp-web.js";
import { retry } from "../../lib/resilience/retry";
import { withTimeout } from "../../lib/resilience/timeout";
import { TIMEOUTS } from "../../config/constants";
import { log } from "../../lib/logging/logger";

export class WhatsAppSender {
  constructor(private readonly client: Client) {}

  async sendText(
    chatId: string,
    text: string,
    replyToMessageId?: string
  ): Promise<void> {
    await retry(async () => {
      await withTimeout(
        async () => {
          const options: any = {};
          if (replyToMessageId) {
            options.quotedMessageId = replyToMessageId;
          }
          await this.client.sendMessage(chatId, text, options);
        },
        TIMEOUTS.EXTERNAL_API_MS,
        "whatsapp-send-text"
      );
    }, "whatsapp-send-text");
  }

  async sendMedia(
    chatId: string,
    filePath: string,
    caption?: string,
    replyToMessageId?: string,
    sendAudioAsVoice?: boolean
  ): Promise<void> {
    await retry(async () => {
      await withTimeout(
        async () => {
          const media = MessageMedia.fromFilePath(filePath);
          const options: any = { caption };
          if (replyToMessageId) {
            options.quotedMessageId = replyToMessageId;
          }
          if (sendAudioAsVoice) {
            options.sendAudioAsVoice = true;
          }
          await this.client.sendMessage(chatId, media, options);
        },
        TIMEOUTS.EXTERNAL_API_MS,
        "whatsapp-send-media"
      );
    }, "whatsapp-send-media");
  }

  async sendSticker(
    chatId: string,
    filePath: string,
    replyToMessageId?: string
  ): Promise<void> {
    await retry(async () => {
      await withTimeout(
        async () => {
          const media = MessageMedia.fromFilePath(filePath);
          const options: any = { sendMediaAsSticker: true };
          if (replyToMessageId) {
            options.quotedMessageId = replyToMessageId;
          }
          await this.client.sendMessage(chatId, media, options);
        },
        TIMEOUTS.EXTERNAL_API_MS,
        "whatsapp-send-sticker"
      );
    }, "whatsapp-send-sticker");
  }

  async sendReaction(messageId: string, emoji: string): Promise<void> {
    try {
      const message = await this.client.getMessageById(messageId);
      await message.react(emoji);
    } catch (error) {
      log("warn", "Failed to send reaction", {
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
      }, "whatsapp-remove-participant");

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
      return withTimeout(
        async () => {
          const message = await this.client.getMessageById(messageId);

          if (!message.hasMedia) {
            throw new Error("Message has no media");
          }

          const media = await message.downloadMedia();
          return Buffer.from(media.data, "base64");
        },
        TIMEOUTS.EXTERNAL_API_MS,
        "whatsapp-download-media"
      );
    }, "whatsapp-download-media");
  }

  async getMediaInfo(
    messageId: string
  ): Promise<{ sizeBytes: number; mimeType: string } | null> {
    try {
      return await withTimeout(
        async () => {
          const message = await this.client.getMessageById(messageId);

          if (!message.hasMedia) {
            return null;
          }

          const media = await message.downloadMedia();
          return {
            sizeBytes: Buffer.from(media.data, "base64").length,
            mimeType: media.mimetype,
          };
        },
        TIMEOUTS.EXTERNAL_API_MS,
        "whatsapp-get-media-info"
      );
    } catch (error) {
      log("warn", "Failed to get media info", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
