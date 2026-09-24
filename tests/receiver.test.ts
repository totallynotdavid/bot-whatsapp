import { EventEmitter } from "node:events";
import { describe, expect, test, vi } from "vitest";
import type { Client, Message as WWebJSMessage } from "whatsapp-web.js";
import type { Message } from "../src/domain/message";
import { WhatsAppReceiver } from "../src/infrastructure/whatsapp/receiver";

const PREFIX = "!";

function makeRaw(body: string) {
  const bridge = { touched: false };
  const touch = () => {
    bridge.touched = true;
  };
  const raw = {
    id: { _serialized: "msg-1" },
    body,
    timestamp: 1_700_000_000,
    hasMedia: false,
    hasQuotedMsg: false,
    type: "chat",
    getContact: async () => {
      touch();
      return { number: "51911111111", pushname: "Ana", name: undefined };
    },
    getChat: async () => {
      touch();
      return {
        id: { _serialized: "chat-1@g.us" },
        isGroup: true,
        name: "Team",
      };
    },
    getMentions: async () => {
      touch();
      return [{ id: { _serialized: "51922222222@c.us" } }];
    },
  };
  return { raw: raw as unknown as WWebJSMessage, bridge };
}

async function dispatch(body: string) {
  const client = new EventEmitter();
  const receiver = new WhatsAppReceiver(client as unknown as Client, PREFIX);
  const handler = vi.fn<(message: Message) => Promise<void>>(async () => {});
  receiver.onMessage(handler);

  const { raw, bridge } = makeRaw(body);
  // emit() does not await async listeners, so the listeners are invoked
  // directly; that makes the "message" event name part of the contract.
  await Promise.all(client.listeners("message").map((l) => l(raw)));
  return { handler, bridge };
}

describe("WhatsAppReceiver", () => {
  test.each(["hello everyone", "", "   ", "!", "  ! ", "look !ping"])(
    "skips non-command body %j without touching the bridge or handler",
    async (body) => {
      const { handler, bridge } = await dispatch(body);

      expect(bridge.touched).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    }
  );

  test("converts a command message and passes it to the handler", async () => {
    const { handler, bridge } = await dispatch("!ping now");

    expect(bridge.touched).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0]).toEqual({
      id: "msg-1",
      chatId: "chat-1@g.us",
      senderId: "51911111111",
      senderName: "Ana",
      body: "!ping now",
      timestamp: new Date(1_700_000_000 * 1000),
      isGroup: true,
      groupName: "Team",
      hasMedia: false,
      mentionedUserIds: ["51922222222"],
    });
  });

  test("stop() stops taking messages and waits for the ones in flight", async () => {
    const client = new EventEmitter();
    const receiver = new WhatsAppReceiver(client as unknown as Client, PREFIX);
    let finishHandler = () => {};
    const handled: string[] = [];
    receiver.onMessage(async (message) => {
      await new Promise<void>((resolve) => {
        finishHandler = resolve;
      });
      handled.push(message.body);
    });

    const [listener] = client.listeners("message");
    const inFlight = listener!(makeRaw("!ping").raw);
    await new Promise((resolve) => setImmediate(resolve));

    let stopped = false;
    const stopping = (async () => {
      await receiver.stop();
      stopped = true;
    })();
    await new Promise((resolve) => setImmediate(resolve));

    expect(client.listenerCount("message")).toBe(0);
    expect(stopped).toBe(false);

    finishHandler();
    await Promise.all([inFlight, stopping]);
    expect(handled).toEqual(["!ping"]);
    expect(stopped).toBe(true);
  });
});
