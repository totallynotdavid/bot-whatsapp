import type { MessageSender } from "@bot-whatsapp/whatsapp";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { withRetry } from "../src/lib/resilience/with-retry";
import { loadTestConfig } from "./fixtures";

loadTestConfig();

const CHAT_ID = "51922222222@c.us";

function makeFakeSender(failCount = 0) {
  const calls: string[] = [];
  let sendTextAttempts = 0;
  const sender: MessageSender = {
    toChatId: (phone) => `${phone}@c.us`,
    sendText: async (chatId, text, replyToMessageId) => {
      sendTextAttempts++;
      calls.push(`sendText:${chatId}:${text}:${replyToMessageId ?? ""}`);
      if (sendTextAttempts <= failCount) {
        throw new Error("simulated send failure");
      }
    },
    sendMedia: async (
      chatId,
      filePath,
      caption,
      replyToMessageId,
      sendAudioAsVoice,
      sendVideoAsGif
    ) => {
      calls.push(
        `sendMedia:${chatId}:${filePath}:${caption ?? ""}:${replyToMessageId ?? ""}:${sendAudioAsVoice ?? false}:${sendVideoAsGif ?? false}`
      );
    },
    sendSticker: async (chatId, filePath, replyToMessageId) => {
      calls.push(`sendSticker:${chatId}:${filePath}:${replyToMessageId ?? ""}`);
    },
    sendReaction: async (messageId, emoji) => {
      calls.push(`sendReaction:${messageId}:${emoji}`);
    },
    removeParticipant: async (chatId, userId) => {
      calls.push(`removeParticipant:${chatId}:${userId}`);
    },
    isGroupAdmin: async () => {
      calls.push("isGroupAdmin");
      return true;
    },
    getMediaInfo: async () => {
      calls.push("getMediaInfo");
      return null;
    },
    downloadMedia: async () => {
      calls.push("downloadMedia");
      return null;
    },
    getProfilePicUrl: async () => {
      calls.push("getProfilePicUrl");
      return null;
    },
  };
  return { sender, calls, attempts: () => sendTextAttempts };
}

// Rejects are attached before timers advance so backoff sleeps run instantly.
async function settle<T>(promise: Promise<T>) {
  const outcome = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error })
  );
  await vi.runAllTimersAsync();
  return outcome;
}

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("toChatId, sendReaction, removeParticipant, isGroupAdmin, getMediaInfo, downloadMedia and getProfilePicUrl are forwarded unwrapped", async () => {
    const { sender, calls } = makeFakeSender();
    const retrying = withRetry(sender);

    expect(retrying.toChatId("51900000000")).toBe("51900000000@c.us");
    await retrying.sendReaction("msg-1", "👍");
    await retrying.removeParticipant(CHAT_ID, "51900000000");
    await retrying.isGroupAdmin(CHAT_ID, "51900000000");
    await retrying.getMediaInfo("msg-1");
    await retrying.downloadMedia("msg-1");
    await retrying.getProfilePicUrl("51900000000");

    expect(calls).toEqual([
      "sendReaction:msg-1:👍",
      `removeParticipant:${CHAT_ID}:51900000000`,
      "isGroupAdmin",
      "getMediaInfo",
      "downloadMedia",
      "getProfilePicUrl",
    ]);
  });

  test("a successful sendText is attempted once and forwards every argument", async () => {
    const { sender, calls, attempts } = makeFakeSender();
    const retrying = withRetry(sender);

    const outcome = await settle(retrying.sendText(CHAT_ID, "hola", "msg-1"));

    expect(outcome).toEqual({ value: undefined });
    expect(attempts()).toBe(1);
    expect(calls).toEqual([`sendText:${CHAT_ID}:hola:msg-1`]);
  });

  test("sendText retries a transient failure and succeeds on the second attempt", async () => {
    const { sender, attempts } = makeFakeSender(1);
    const retrying = withRetry(sender);

    const outcome = await settle(retrying.sendText(CHAT_ID, "hola", "msg-1"));

    expect(outcome).toEqual({ value: undefined });
    expect(attempts()).toBe(2);
  });

  test("sendText gives up and throws after exhausting every retry", async () => {
    const { sender, attempts } = makeFakeSender(Number.POSITIVE_INFINITY);
    const retrying = withRetry(sender);

    const outcome = await settle(retrying.sendText(CHAT_ID, "hola", "msg-1"));

    expect(outcome).toEqual({
      error: expect.objectContaining({ message: "simulated send failure" }),
    });
    expect(attempts()).toBe(3);
  });

  test("sendMedia and sendSticker are retried and forward every argument", async () => {
    let mediaAttempts = 0;
    let stickerAttempts = 0;
    const sender: MessageSender = {
      toChatId: (phone) => phone,
      sendText: async () => {},
      sendMedia: async (
        chatId,
        filePath,
        caption,
        replyToMessageId,
        sendAudioAsVoice,
        sendVideoAsGif
      ) => {
        mediaAttempts++;
        if (mediaAttempts === 1) throw new Error("simulated media failure");
        expect(chatId).toBe(CHAT_ID);
        expect(filePath).toBe("/tmp/file.png");
        expect(caption).toBe("caption");
        expect(replyToMessageId).toBe("msg-1");
        expect(sendAudioAsVoice).toBe(true);
        expect(sendVideoAsGif).toBe(false);
      },
      sendSticker: async (chatId, filePath, replyToMessageId) => {
        stickerAttempts++;
        if (stickerAttempts === 1) throw new Error("simulated sticker failure");
        expect(chatId).toBe(CHAT_ID);
        expect(filePath).toBe("/tmp/file.webp");
        expect(replyToMessageId).toBe("msg-1");
      },
      sendReaction: async () => {},
      removeParticipant: async () => {},
      isGroupAdmin: async () => true,
      getMediaInfo: async () => null,
      downloadMedia: async () => null,
      getProfilePicUrl: async () => null,
    };
    const retrying = withRetry(sender);

    await settle(
      retrying.sendMedia(
        CHAT_ID,
        "/tmp/file.png",
        "caption",
        "msg-1",
        true,
        false
      )
    );
    expect(mediaAttempts).toBe(2);

    await settle(retrying.sendSticker(CHAT_ID, "/tmp/file.webp", "msg-1"));
    expect(stickerAttempts).toBe(2);
  });
});
