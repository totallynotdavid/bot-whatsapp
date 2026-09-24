import type { MediaInfo } from "../../domain/media";

export interface DownloadedMedia extends MediaInfo {
  readonly buffer: Buffer;
}

// Every method rejects on failure; none reports failure through its return
// value.
export interface MessageSender {
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
