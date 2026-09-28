import type {
  DownloadedMedia,
  IncomingMessage,
  Logger,
  MediaInfo,
  WhatsAppTransport,
} from "@bot-whatsapp/whatsapp";
import { MessageStore } from "./message-store";
import { BaileysReceiver } from "./receiver";
import { BaileysSender } from "./sender";
import type { BaileysSocket, MediaDownloader } from "./socket-types";

export interface BaileysConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

// Wraps an already-constructed baileys socket, so tests can inject a fake
// socket without going through the real library. `store` and
// `downloadContent` default to production values but stay injectable
// because they are this adapter's own boundary onto the library: baileys
// has no built-in lookup from a message id back to its content.
export class BaileysTransport implements WhatsAppTransport {
  private readonly receiver: BaileysReceiver;
  private readonly sender: BaileysSender;

  constructor(
    private readonly connection: BaileysConnection,
    socket: BaileysSocket,
    downloadContent: MediaDownloader,
    logger: Logger,
    store: MessageStore = new MessageStore()
  ) {
    this.receiver = new BaileysReceiver(socket, store, logger);
    this.sender = new BaileysSender(socket, store, downloadContent, logger);
  }

  connect(): Promise<void> {
    return this.connection.connect();
  }

  disconnect(): Promise<void> {
    return this.connection.disconnect();
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
