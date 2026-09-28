import { describe, expect, test } from "vitest";
import { retry, withRetry } from "../src/lib/resilience/with-retry";
import { FakeTransport } from "./fixtures";

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

describe("withRetry", () => {
  test("retries a send the transport drops", async () => {
    const transport = new FakeTransport();
    const sender = withRetry(transport, noSleep);
    transport.failNextSends(1);

    await sender.sendText("chat", "hola");

    expect(transport.texts).toEqual([{ chatId: "chat", text: "hola" }]);
  });

  test("does not retry a reaction, which the transport already tolerates", async () => {
    const transport = new FakeTransport();
    const sender = withRetry(transport, noSleep);

    await sender.sendReaction("msg-1", "✅");

    expect(transport.reactions).toEqual([{ messageId: "msg-1", emoji: "✅" }]);
    expect(sender.toChatId("51999999999")).toBe("51999999999@s.whatsapp.net");
  });
});
