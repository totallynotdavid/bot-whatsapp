import { describe, expect, test } from "vitest";
import {
  retry,
  retryingImageDownloads,
  retryingMediaDownloads,
  retryingReads,
} from "../src/lib/resilience/with-retry";
import {
  FakeAttendanceStore,
  FakeImageDownloader,
  FakeTransport,
  LIBRARIAN_PHONE,
} from "./fixtures";

const noSleep = { sleep: async () => {} };

describe("retry", () => {
  test("returns the first success without waiting", async () => {
    const sleeps: number[] = [];

    const result = await retry(async () => "ok", {
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    expect(result).toBe("ok");
    expect(sleeps).toEqual([]);
  });

  test("doubles the delay after each failure", async () => {
    const sleeps: number[] = [];
    let calls = 0;

    const result = await retry(
      async () => {
        if (++calls < 4) throw new Error("no");
        return calls;
      },
      {
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      }
    );

    expect(result).toBe(4);
    expect(sleeps).toEqual([1000, 2000, 4000]);
  });

  test("gives up after the configured retries and throws the last error", async () => {
    let calls = 0;

    await expect(
      retry(
        async () => {
          throw new Error(`attempt ${++calls}`);
        },
        { ...noSleep, retries: 2 }
      )
    ).rejects.toThrow("attempt 3");
    expect(calls).toBe(3);
  });
});

describe("retryingReads", () => {
  test("retries each read the store drops", async () => {
    const attendance = new FakeAttendanceStore();
    attendance.librarians.set(LIBRARIAN_PHONE, "Ana");
    attendance.seed({
      action: "open",
      managerNumber: LIBRARIAN_PHONE,
      imageUrl: "https://files.example/a.jpg",
      timestamp: new Date(2025, 2, 10, 8),
    });
    const store = retryingReads(attendance, noSleep);

    attendance.failNextReads(2);
    expect(await store.latest("open")).toMatchObject({
      managerNumber: LIBRARIAN_PHONE,
    });
    attendance.failNextReads(2);
    expect(
      await store.openingsBetween(new Date(2025, 2, 10), new Date(2025, 2, 11))
    ).toHaveLength(1);
    attendance.failNextReads(2);
    expect(await store.librarianName(LIBRARIAN_PHONE)).toBe("Ana");
  });

  test("gives up on a store that stays down", async () => {
    const attendance = new FakeAttendanceStore();
    attendance.failReads = true;
    const store = retryingReads(attendance, { ...noSleep, retries: 2 });

    await expect(store.latest("open")).rejects.toThrow("database down");
    expect(attendance.readAttempts).toBe(3);
  });

  test("records once even when the write fails", async () => {
    const attendance = new FakeAttendanceStore();
    attendance.failRecords = true;
    const store = retryingReads(attendance, noSleep);

    await expect(
      store.record({
        action: "open",
        managerNumber: LIBRARIAN_PHONE,
        imageUrl: "https://files.example/a.jpg",
        timestamp: new Date(),
      })
    ).rejects.toThrow("database down");
    expect(attendance.recordAttempts).toBe(1);
  });
});

describe("retryingImageDownloads", () => {
  test("retries a download that fails", async () => {
    const images = new FakeImageDownloader();
    images.contents.set("https://files.example/a.jpg", "photo");
    images.failNext(2);

    const image = await retryingImageDownloads(images, noSleep).download(
      "https://files.example/a.jpg"
    );
    await image.dispose();

    expect(images.attempts).toBe(3);
  });
});

describe("retryingMediaDownloads", () => {
  test("retries a media download the transport drops", async () => {
    const transport = new FakeTransport();
    transport.attachMedia("msg-1", "jpeg-bytes");
    transport.failNextDownloads(2);
    const sender = retryingMediaDownloads(transport, noSleep);

    const media = await sender.downloadMedia("msg-1");

    expect(media?.buffer.toString()).toBe("jpeg-bytes");
    expect(transport.downloadAttempts).toBe(3);
  });

  test("sends once: a send that fails may have been delivered", async () => {
    const transport = new FakeTransport();
    const sender = retryingMediaDownloads(transport, noSleep);
    transport.failNextSends(1);

    await expect(sender.sendText("chat", "hola")).rejects.toThrow(
      "connection closed"
    );
    await sender.sendText("chat", "hola otra vez");

    expect(transport.texts).toEqual([
      { chatId: "chat", text: "hola otra vez" },
    ]);
  });

  test("passes reactions and chat ids straight through", async () => {
    const transport = new FakeTransport();
    const sender = retryingMediaDownloads(transport, noSleep);

    await sender.sendReaction("msg-1", "✅");

    expect(transport.reactions).toEqual([{ messageId: "msg-1", emoji: "✅" }]);
    expect(sender.toChatId("51999999999")).toBe("51999999999@s.whatsapp.net");
  });
});
