import type { Client } from "whatsapp-web.js";
import type {
  DownloadedMedia,
  IncomingMessage,
  MediaInfo,
  WhatsAppTransport,
} from "@bot-whatsapp/whatsapp";
import { connect } from "./client";
import { WwebjsReceiver } from "./receiver";
import { WwebjsSender } from "./sender";

// Wraps an already-constructed whatsapp-web.js Client, so tests can inject a
// fake client without going through the real library.
export class WwebjsTransport implements WhatsAppTransport {
  private readonly receiver: WwebjsReceiver;
  private readonly sender: WwebjsSender;

  constructor(
    private readonly client: Client,
    commandPrefix: string
  ) {
    this.receiver = new WwebjsReceiver(client, commandPrefix);
    this.sender = new WwebjsSender(client);
  }

  connect(): Promise<void> {
    return connect(this.client);
  }

  disconnect(): Promise<void> {
    return this.client.destroy();
  }

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.receiver.onMessage(handler);
  }

  stopReceiving(): Promise<void> {
    return this.receiver.stop();
  }

  toChatId(phoneNumber: string): string {
    return this.sender.toChatId(phoneNumber);
  }

  sendText(
    chatId: string,
    text: string,
    replyToMessageId?: string
  ): Promise<void> {
    return this.sender.sendText(chatId, text, replyToMessageId);
  }

  sendMedia(
    chatId: string,
    filePath: string,
    caption?: string,
    replyToMessageId?: string,
    sendAudioAsVoice?: boolean,
    sendVideoAsGif?: boolean
  ): Promise<void> {
    return this.sender.sendMedia(
      chatId,
      filePath,
      caption,
      replyToMessageId,
      sendAudioAsVoice,
      sendVideoAsGif
    );
  }

  sendSticker(
    chatId: string,
    filePath: string,
    replyToMessageId?: string
  ): Promise<void> {
    return this.sender.sendSticker(chatId, filePath, replyToMessageId);
  }

  sendReaction(messageId: string, emoji: string): Promise<void> {
    return this.sender.sendReaction(messageId, emoji);
  }

  removeParticipant(chatId: string, userId: string): Promise<void> {
    return this.sender.removeParticipant(chatId, userId);
  }

  isGroupAdmin(chatId: string, userId: string): Promise<boolean> {
    return this.sender.isGroupAdmin(chatId, userId);
  }

  getMediaInfo(messageId: string): Promise<MediaInfo | null> {
    return this.sender.getMediaInfo(messageId);
  }

  downloadMedia(
    messageId: string,
    signal?: AbortSignal
  ): Promise<DownloadedMedia | null> {
    return this.sender.downloadMedia(messageId, signal);
  }

  getProfilePicUrl(userId: string): Promise<string | null> {
    return this.sender.getProfilePicUrl(userId);
  }
}
