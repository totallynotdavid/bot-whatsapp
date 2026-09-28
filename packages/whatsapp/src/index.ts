export type MediaType = "image" | "video" | "audio" | "document";

// The shape an adapter delivers to onMessage. Chat and sender ids are opaque
// strings in whatever format the underlying library uses; app code never
// parses or builds them itself, except through toChatId.
export interface IncomingMessage {
  readonly id: string;
  readonly chatId: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly body: string;
  readonly timestamp: Date;
  readonly isGroup: boolean;
  readonly groupName?: string;
  readonly hasMedia: boolean;
  readonly mediaType?: MediaType;
  readonly mentionedUserIds: string[];
  readonly quotedMessageId?: string;
  readonly quotedUserId?: string;
  readonly quotedBody?: string;
}

export interface MediaInfo {
  readonly sizeBytes: number;
  readonly mimeType: string;
}

export interface DownloadedMedia extends MediaInfo {
  readonly buffer: Buffer;
}

// Every method rejects on failure; none reports failure through its return
// value, except sendReaction (logged, not thrown) and the null-returning
// lookups noted below.
export interface MessageSender {
  // Maps a bare phone number (digits only) to the chat id used to message
  // that person directly. The mapping is transport-specific: it is the only
  // place app code turns a phone number into a chat id.
  toChatId(phoneNumber: string): string;

  sendText(
    chatId: string,
    text: string,
    replyToMessageId?: string
  ): Promise<void>;

  sendMedia(
    chatId: string,
    filePath: string,
    caption?: string,
    replyToMessageId?: string,
    sendAudioAsVoice?: boolean,
    sendVideoAsGif?: boolean
  ): Promise<void>;

  sendSticker(
    chatId: string,
    filePath: string,
    replyToMessageId?: string
  ): Promise<void>;

  // A reaction is decoration, so a failure is logged instead of thrown.
  sendReaction(messageId: string, emoji: string): Promise<void>;

  removeParticipant(chatId: string, userId: string): Promise<void>;

  isGroupAdmin(chatId: string, userId: string): Promise<boolean>;

  // Null means the message has no media. Reads the size and type the message
  // already carries, without downloading the file.
  getMediaInfo(messageId: string): Promise<MediaInfo | null>;

  downloadMedia(
    messageId: string,
    signal?: AbortSignal
  ): Promise<DownloadedMedia | null>;

  // Null means the user has no visible profile picture.
  getProfilePicUrl(userId: string): Promise<string | null>;
}

export interface WhatsAppTransport extends MessageSender {
  // Authenticates and opens the connection. Resolves once the session is
  // ready to send and receive.
  connect(): Promise<void>;

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void;

  // Stops taking new messages and waits for handlers already running.
  stopReceiving(): Promise<void>;

  disconnect(): Promise<void>;
}
