import { SEND_RETRY } from "../../config/constants";
import type { ReplySender } from "../../application/ports/reply-sender";

export interface RetryOptions {
  readonly retries?: number;
  readonly initialDelayMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export async function retry<T>(
  operation: () => Promise<T>,
  {
    retries = SEND_RETRY.RETRIES,
    initialDelayMs = SEND_RETRY.INITIAL_DELAY_MS,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  }: RetryOptions = {}
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      await sleep(initialDelayMs * 2 ** attempt);
    }
  }
}

// Only the two sends are retried. Retrying a whole command would repeat its
// side effects, such as recording the same opening twice.
export function withRetry(
  sender: ReplySender,
  options?: RetryOptions
): ReplySender {
  return {
    toChatId: sender.toChatId.bind(sender),
    sendText: (chatId, text, replyToMessageId) =>
      retry(() => sender.sendText(chatId, text, replyToMessageId), options),
    sendMedia: (chatId, filePath, caption, replyToMessageId, ...flags) =>
      retry(
        () =>
          sender.sendMedia(
            chatId,
            filePath,
            caption,
            replyToMessageId,
            ...flags
          ),
        options
      ),
    sendReaction: sender.sendReaction.bind(sender),
    downloadMedia: sender.downloadMedia.bind(sender),
  };
}
