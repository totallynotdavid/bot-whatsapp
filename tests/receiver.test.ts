import { EventEmitter } from "node:events";
import { describe, expect, test, vi } from "vitest";
import type { Client, Message as WWebJSMessage } from "whatsapp-web.js";
import type { Message } from "../src/domain/message";
import { WhatsAppReceiver } from "../src/infrastructure/whatsapp/receiver";

const PREFIX = "!";

function makeRaw(body: string) {
  const calls = { getContact: 0, getChat: 0, getMentions: 0 };
  const raw = {
    id: { _serialized: "msg-1" },
    body,
    timestamp: 1_700_000_000,
    hasMedia: false,
    hasQuotedMsg: false,
    type: "chat",
    getContact: async () => {
      calls.getContact++;
      return { number: "51911111111", pushname: "Ana", name: undefined };
    },
    getChat: async () => {
      calls.getChat++;
      return {
        id: { _serialized: "chat-1@g.us" },
        isGroup: true,
        name: "Team",
      };
    },
    getMentions: async () => {
      calls.getMentions++;
      return [{ id: { _serialized: "51922222222@c.us" } }];
    },
  };
  return { raw: raw as unknown as WWebJSMessage, calls };
}

async function dispatch(body: string) {
  const client = new EventEmitter();
  const receiver = new WhatsAppReceiver(client as unknown as Client, PREFIX);
  const handler = vi.fn<(message: Message) => Promise<void>>(async () => {});
  receiver.onMessage(handler);

  const { raw, calls } = makeRaw(body);
  await Promise.all(client.listeners("message").map((l) => l(raw)));
  return { handler, calls };
}

describe("WhatsAppReceiver", () => {
  test.each(["hello everyone", "", "   ", "!", "  ! ", "look !ping"])(
    "skips non-command body %j without touching the bridge or handler",
    async (body) => {
      const { handler, calls } = await dispatch(body);

      expect(calls).toEqual({ getContact: 0, getChat: 0, getMentions: 0 });
      expect(handler).not.toHaveBeenCalled();
    }
  );

  test("converts a command message and passes it to the handler", async () => {
    const { handler, calls } = await dispatch("!ping now");

    expect(calls).toEqual({ getContact: 1, getChat: 1, getMentions: 1 });
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
      mediaType: undefined,
      mentionedUserIds: ["51922222222"],
      quotedMessageId: undefined,
      quotedUserId: undefined,
    });
  });
});
