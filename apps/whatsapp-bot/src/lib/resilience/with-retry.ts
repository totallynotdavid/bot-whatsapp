import type { MessageSender } from "@bot-whatsapp/whatsapp";
import { retry } from "./retry";

// Only the three send operations are retried: they are the ones a transient
// WhatsApp/network hiccup actually affects mid-command. Reads (isGroupAdmin,
// getMediaInfo, ...) and moderation calls are left alone so a stuck group
// action does not silently repeat.
export function withRetry(sender: MessageSender): MessageSender {
  return {
    toChatId: sender.toChatId.bind(sender),
    sendText: (chatId, text, replyToMessageId) =>
      retry(
        () => sender.sendText(chatId, text, replyToMessageId),
        "whatsapp-send-text"
      ),
    sendMedia: (
      chatId,
      filePath,
      caption,
      replyToMessageId,
      sendAudioAsVoice,
      sendVideoAsGif
    ) =>
      retry(
        () =>
          sender.sendMedia(
            chatId,
            filePath,
            caption,
            replyToMessageId,
            sendAudioAsVoice,
            sendVideoAsGif
          ),
        "whatsapp-send-media"
      ),
    sendSticker: (chatId, filePath, replyToMessageId) =>
      retry(
        () => sender.sendSticker(chatId, filePath, replyToMessageId),
        "whatsapp-send-sticker"
      ),
    sendReaction: sender.sendReaction.bind(sender),
    removeParticipant: sender.removeParticipant.bind(sender),
    isGroupAdmin: sender.isGroupAdmin.bind(sender),
    getMediaInfo: sender.getMediaInfo.bind(sender),
    downloadMedia: sender.downloadMedia.bind(sender),
    getProfilePicUrl: sender.getProfilePicUrl.bind(sender),
  };
}
