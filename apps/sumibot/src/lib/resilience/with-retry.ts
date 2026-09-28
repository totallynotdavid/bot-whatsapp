import { READ_RETRY } from "../../config/constants";
import type { AttendanceStore } from "../../application/ports/attendance-store";
import type { ImageDownloader } from "../../application/ports/photo-storage";
import type { ReplySender } from "../../application/ports/reply-sender";

export interface RetryOptions {
  readonly retries?: number;
  readonly initialDelayMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export async function retry<T>(
  operation: () => Promise<T>,
  {
    retries = READ_RETRY.RETRIES,
    initialDelayMs = READ_RETRY.INITIAL_DELAY_MS,
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

// Only reads are retried. A write or a send can fail after it took effect,
// so repeating it could record an opening or deliver a message twice.
export function retryingReads(
  store: AttendanceStore,
  options?: RetryOptions
): AttendanceStore {
  return {
    record: (entry) => store.record(entry),
    latest: (action) => retry(() => store.latest(action), options),
    openingsBetween: (from, to) =>
      retry(() => store.openingsBetween(from, to), options),
    librarianName: (managerNumber) =>
      retry(() => store.librarianName(managerNumber), options),
  };
}

export function retryingImageDownloads(
  images: ImageDownloader,
  options?: RetryOptions
): ImageDownloader {
  return { download: (url) => retry(() => images.download(url), options) };
}

export function retryingMediaDownloads(
  sender: ReplySender,
  options?: RetryOptions
): ReplySender {
  return {
    toChatId: (phoneNumber) => sender.toChatId(phoneNumber),
    sendText: (chatId, text, replyToMessageId) =>
      sender.sendText(chatId, text, replyToMessageId),
    sendMedia: (chatId, filePath, caption, replyToMessageId, ...flags) =>
      sender.sendMedia(chatId, filePath, caption, replyToMessageId, ...flags),
    sendReaction: (messageId, emoji) => sender.sendReaction(messageId, emoji),
    downloadMedia: (messageId, signal) =>
      retry(() => sender.downloadMedia(messageId, signal), options),
  };
}
