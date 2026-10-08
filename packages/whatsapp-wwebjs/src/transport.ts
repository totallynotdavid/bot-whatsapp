import type { Client } from "whatsapp-web.js";
import type {
  DownloadedMedia,
  IncomingMessage,
  Logger,
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
  private open = false;
  private closing = false;

  constructor(
    private readonly client: Client,
    logger: Logger
  ) {
    this.receiver = new WwebjsReceiver(client, logger);
    this.sender = new WwebjsSender(client, logger);
  }

  async connect(): Promise<void> {
    await connect(this.client);
    this.open = true;
  }

  disconnect(): Promise<void> {
    this.closing = true;
    return this.client.destroy();
  }

  // whatsapp-web.js leaves a disconnected client unusable until it is
  // initialized again, with a browser page that may be wedged, so a
  // disconnect ends the session and the app restarts the whole process. A
  // disconnect before connect() resolved rejects connect() instead.
  onClose(handler: (error: Error) => void): void {
    this.client.on("disconnected", (reason) => {
      if (this.open && !this.closing) {
        handler(new Error(`WhatsApp disconnected: ${reason}`));
      }
    });
  }

  onMessage(
    handler: (message: IncomingMessage) => Promise<void>,
    isCommand?: (body: string) => boolean
  ): void {
    this.receiver.onMessage(handler, isCommand);
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
