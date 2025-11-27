export interface IMessageSender {
  sendText(chatId: string, text: string, replyToId?: string): Promise<void>;
  sendMedia(
    chatId: string,
    path: string,
    caption?: string,
    replyToId?: string
  ): Promise<void>;
  sendSticker(chatId: string, path: string, replyToId?: string): Promise<void>;
  sendReaction(messageId: string, emoji: string): Promise<void>;
  removeParticipant(chatId: string, userId: string): Promise<boolean>;
  downloadMedia(messageId: string): Promise<Buffer>;
  getMediaInfo(
    messageId: string
  ): Promise<{ size: number; mimeType: string } | null>;
}
