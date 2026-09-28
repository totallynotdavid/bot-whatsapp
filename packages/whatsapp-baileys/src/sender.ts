import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { Boom } from "@hapi/boom";
import mime from "mime-types";
import {
  isJidGroup,
  type AnyMessageContent,
  type WAMessage,
  type WAMessageKey,
} from "@whiskeysockets/baileys";
import type {
  DownloadedMedia,
  Logger,
  MediaInfo,
  MessageSender,
} from "@bot-whatsapp/whatsapp";
import { extractMediaInfo } from "./message-content";
import { normalizePhoneNumber, toJid } from "./message-mapping";
import type { MessageStore } from "./message-store";
import type { BaileysSocket, MediaDownloader } from "./socket-types";
import { convertToWebpSticker } from "./webp-sticker";

const ANIMATED_STICKER_KINDS = new Set([
  "video/mp4",
  "video/webm",
  "image/gif",
]);

// WhatsApp's XMPP-style stanza error code for item-not-found, as reported in
// Boom.data by assertNodeErrorFree (see getProfilePicUrl below).
const ITEM_NOT_FOUND = 404;

export class BaileysSender implements MessageSender {
  constructor(
    private readonly socket: BaileysSocket,
    private readonly store: MessageStore,
    private readonly downloadContent: MediaDownloader,
    private readonly logger: Logger
  ) {}

  toChatId(phoneNumber: string): string {
    return toJid(phoneNumber);
  }

  async sendText(
    chatId: string,
    text: string,
    replyToMessageId?: string
  ): Promise<void> {
    await this.socket.sendMessage(
      chatId,
      { text },
      {
        quoted: this.quote(chatId, replyToMessageId),
      }
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
    const buffer = await readFile(filePath);
    const mimetype = mime.lookup(filePath) || "application/octet-stream";
    const kind = mimetype.split("/")[0];
    const content: AnyMessageContent =
      kind === "image"
        ? { image: buffer, caption, mimetype }
        : kind === "video"
          ? {
              video: buffer,
              caption,
              mimetype,
              gifPlayback: sendVideoAsGif || undefined,
            }
          : kind === "audio"
            ? { audio: buffer, mimetype, ptt: sendAudioAsVoice || undefined }
            : {
                document: buffer,
                mimetype,
                caption,
                fileName: basename(filePath),
              };

    await this.socket.sendMessage(chatId, content, {
      quoted: this.quote(chatId, replyToMessageId),
    });
  }

  async sendSticker(
    chatId: string,
    filePath: string,
    replyToMessageId?: string
  ): Promise<void> {
    const mimetype = mime.lookup(filePath) || "application/octet-stream";
    const isAnimated = ANIMATED_STICKER_KINDS.has(mimetype);
    const buffer = await convertToWebpSticker(filePath, isAnimated);
    await this.socket.sendMessage(
      chatId,
      { sticker: buffer },
      { quoted: this.quote(chatId, replyToMessageId) }
    );
  }

  async sendReaction(messageId: string, emoji: string): Promise<void> {
    try {
      const target = this.store.get(messageId);
      if (!target) throw new Error(`Unknown message: ${messageId}`);
      await this.socket.sendMessage(target.key.remoteJid ?? "", {
        react: { text: emoji, key: target.key },
      });
    } catch (error) {
      this.logger("warn", "WhatsApp reaction failed", {
        event: "whatsapp_reaction_failed",
        messageId,
        emoji,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async removeParticipant(chatId: string, userId: string): Promise<void> {
    this.assertGroup(chatId);
    await this.socket.groupParticipantsUpdate(
      chatId,
      [toJid(userId)],
      "remove"
    );
  }

  async isGroupAdmin(chatId: string, userId: string): Promise<boolean> {
    this.assertGroup(chatId);
    const metadata = await this.socket.groupMetadata(chatId);
    const jid = toJid(userId);
    return metadata.participants.some(
      (participant) =>
        normalizePhoneNumber(participant.id) === normalizePhoneNumber(jid) &&
        (participant.admin === "admin" || participant.admin === "superadmin")
    );
  }

  async getMediaInfo(messageId: string): Promise<MediaInfo | null> {
    const message = this.store.get(messageId);
    return extractMediaInfo(message?.message);
  }

  async downloadMedia(
    messageId: string,
    signal?: AbortSignal
  ): Promise<DownloadedMedia | null> {
    signal?.throwIfAborted();
    const message = this.store.get(messageId);
    const info = extractMediaInfo(message?.message);
    if (!message || !info) return null;

    const buffer = await this.downloadContent(message);
    signal?.throwIfAborted();
    return { buffer, sizeBytes: buffer.length, mimeType: info.mimeType };
  }

  // Null means the user has no visible profile picture. Baileys reports a
  // missing picture as an IQ error whose Boom.data carries WhatsApp's XMPP
  // stanza error code (see assertNodeErrorFree in
  // @whiskeysockets/baileys/lib/WABinary/generic-utils.js). Any other
  // failure (timeout, disconnect, ...) rejects.
  async getProfilePicUrl(userId: string): Promise<string | null> {
    try {
      const url = await this.socket.profilePictureUrl(toJid(userId), "image");
      return url ?? null;
    } catch (error) {
      if (error instanceof Boom && error.data === ITEM_NOT_FOUND) {
        return null;
      }
      throw error;
    }
  }

  private assertGroup(chatId: string): void {
    if (!isJidGroup(chatId)) {
      throw new Error(`Chat is not a group: ${chatId}`);
    }
  }

  // Baileys quotes by embedding the full original message, not just its id;
  // a minimal stub still produces a valid reply reference when the app has
  // not seen the original message (e.g. an id from outside this process).
  private quote(chatId: string, messageId?: string): WAMessage | undefined {
    if (!messageId) return undefined;
    const stored = this.store.get(messageId);
    if (stored) return stored;

    const key: WAMessageKey = {
      remoteJid: chatId,
      id: messageId,
      fromMe: false,
    };
    return { key, message: { conversation: "" } };
  }
}
