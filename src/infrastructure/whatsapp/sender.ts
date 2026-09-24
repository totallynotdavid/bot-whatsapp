import type { Client, GroupChat } from "whatsapp-web.js";
import { MessageMedia } from "whatsapp-web.js";
import type {
  DownloadedMedia,
  MessageSender,
} from "../../application/ports/message-sender";
import type { MediaInfo } from "../../domain/media";
import { toWhatsAppId } from "../../domain/message";
import { retry } from "../../lib/resilience/retry";
import { withTimeout } from "../../lib/resilience/timeout";
import { TIMEOUTS } from "../../config/constants";
import { log } from "../../lib/logging/logger";

export class WhatsAppSender implements MessageSender {
  constructor(private readonly client: Client) {}

  async sendText(
    chatId: string,
    text: string,
    replyToMessageId?: string
  ): Promise<void> {
    await withTimeout(
      async () => {
        await this.client.sendMessage(chatId, text, {
          quotedMessageId: replyToMessageId,
        });
      },
      TIMEOUTS.EXTERNAL_API_MS,
      "whatsapp-send-text"
    );
  }

  async sendMedia(
    chatId: string,
    filePath: string,
    caption?: string,
    replyToMessageId?: string,
    sendAudioAsVoice?: boolean,
    sendVideoAsGif?: boolean
  ): Promise<void> {
    // MessageMedia.fromFilePath reads the whole file synchronously; callers
    // may delete the file after send returns.
    await withTimeout(
      async () => {
        const media = MessageMedia.fromFilePath(filePath);
        await this.client.sendMessage(chatId, media, {
          caption,
          quotedMessageId: replyToMessageId,
          sendAudioAsVoice: sendAudioAsVoice || undefined,
          sendVideoAsGif: sendVideoAsGif || undefined,
        });
      },
      TIMEOUTS.EXTERNAL_API_MS,
      "whatsapp-send-media"
    );
  }

  async sendSticker(
    chatId: string,
    filePath: string,
    replyToMessageId?: string
  ): Promise<void> {
    // MessageMedia.fromFilePath reads the whole file synchronously; callers
    // may delete the file after send returns.
    await withTimeout(
      async () => {
        const media = MessageMedia.fromFilePath(filePath);
        await this.client.sendMessage(chatId, media, {
          sendMediaAsSticker: true,
          quotedMessageId: replyToMessageId,
        });
      },
      TIMEOUTS.EXTERNAL_API_MS,
      "whatsapp-send-sticker"
    );
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

  async removeParticipant(chatId: string, userId: string): Promise<void> {
    const group = await this.getGroup(chatId, "whatsapp-remove-participant");
    await withTimeout(
      () => group.removeParticipants([toWhatsAppId(userId)]),
      TIMEOUTS.EXTERNAL_API_MS,
      "whatsapp-remove-participant"
    );
  }

  async isGroupAdmin(chatId: string, userId: string): Promise<boolean> {
    const group = await this.getGroup(chatId, "whatsapp-is-group-admin");
    const participantId = toWhatsAppId(userId);
    return group.participants.some(
      (participant) =>
        participant.id._serialized === participantId &&
        (participant.isAdmin || participant.isSuperAdmin)
    );
  }

  private async getGroup(
    chatId: string,
    operationName: string
  ): Promise<GroupChat> {
    const chat = await withTimeout(
      () => this.client.getChatById(chatId),
      TIMEOUTS.EXTERNAL_API_MS,
      operationName
    );
    if (!chat.isGroup) {
      throw new Error(`Chat is not a group: ${chatId}`);
    }
    return chat as GroupChat;
  }

  // whatsapp-web.js calls cannot be cancelled; an aborted signal is checked
  // before and after the download.
  async downloadMedia(
    messageId: string,
    signal?: AbortSignal
  ): Promise<DownloadedMedia | null> {
    const media = await withTimeout(
      async () => {
        const message = await this.client.getMessageById(messageId);
        if (!message?.hasMedia) return null;

        const downloaded = await message.downloadMedia();
        if (!downloaded) return null;

        const buffer = Buffer.from(downloaded.data, "base64");
        return {
          buffer,
          sizeBytes: buffer.length,
          mimeType: downloaded.mimetype,
        };
      },
      TIMEOUTS.EXTERNAL_API_MS,
      "whatsapp-download-media",
      signal
    );
    signal?.throwIfAborted();
    return media;
  }

  async getMediaInfo(messageId: string): Promise<MediaInfo | null> {
    const message = await withTimeout(
      () => this.client.getMessageById(messageId),
      TIMEOUTS.EXTERNAL_API_MS,
      "whatsapp-get-media-info"
    );
    if (!message?.hasMedia) return null;

    const { size, mimetype } = message.rawData as {
      size?: unknown;
      mimetype?: unknown;
    };
    if (typeof size !== "number" || typeof mimetype !== "string") return null;
    return { sizeBytes: size, mimeType: mimetype };
  }

  // Null means the user has no visible profile picture.
  async getProfilePicUrl(userId: string): Promise<string | null> {
    const url = await withTimeout(
      () => this.client.getProfilePicUrl(userId),
      TIMEOUTS.EXTERNAL_API_MS,
      "whatsapp-get-profile-pic-url"
    );
    return url || null;
  }
}

export class RetryingWhatsAppSender extends WhatsAppSender {
  override sendText(
    chatId: string,
    text: string,
    replyToMessageId?: string
  ): Promise<void> {
    return retry(
      () => super.sendText(chatId, text, replyToMessageId),
      "whatsapp-send-text"
    );
  }

  override sendMedia(
    chatId: string,
    filePath: string,
    caption?: string,
    replyToMessageId?: string,
    sendAudioAsVoice?: boolean,
    sendVideoAsGif?: boolean
  ): Promise<void> {
    return retry(
      () =>
        super.sendMedia(
          chatId,
          filePath,
          caption,
          replyToMessageId,
          sendAudioAsVoice,
          sendVideoAsGif
        ),
      "whatsapp-send-media"
    );
  }

  override sendSticker(
    chatId: string,
    filePath: string,
    replyToMessageId?: string
  ): Promise<void> {
    return retry(
      () => super.sendSticker(chatId, filePath, replyToMessageId),
      "whatsapp-send-sticker"
    );
  }
}
