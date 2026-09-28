import type { WAMessage } from "@whiskeysockets/baileys";
import { describe, expect, test } from "vitest";
import { BaileysReceiver } from "../src/receiver";
import { MessageStore } from "../src/message-store";
import type { IncomingMessage } from "@bot-whatsapp/whatsapp";
import { FakeBaileysSocket, silentLogger } from "./fixtures";

function createReceiver(): {
  socket: FakeBaileysSocket;
  receiver: BaileysReceiver;
  received: IncomingMessage[];
  store: MessageStore;
} {
  const socket = new FakeBaileysSocket();
  const store = new MessageStore();
  const receiver = new BaileysReceiver(socket, store, silentLogger);
  const received: IncomingMessage[] = [];
  receiver.onMessage(async (message) => {
    received.push(message);
  });
  return { socket, receiver, received, store };
}

describe("LID addressing", () => {
  test("prefers the phone-number jid over a LID for the sender", async () => {
    const { socket, received } = createReceiver();
    const raw: WAMessage = {
      key: {
        remoteJid: "120363000000000000@g.us",
        id: "msg-1",
        fromMe: false,
        participant: "123456789@lid",
        participantAlt: "51900000001@s.whatsapp.net",
      },
      pushName: "Sender",
      messageTimestamp: 1_700_000_000,
      message: { conversation: "!ping" },
    };

    await socket.deliverRaw(raw);

    expect(received).toHaveLength(1);
    expect(received[0]?.senderId).toBe("51900000001");
  });

  test("prefers the phone-number jid over a LID for a self-mention", async () => {
    const { socket, received } = createReceiver();
    const raw: WAMessage = {
      key: {
        remoteJid: "120363000000000000@g.us",
        id: "msg-2",
        fromMe: false,
        participant: "123456789@lid",
        participantAlt: "51900000001@s.whatsapp.net",
      },
      pushName: "Sender",
      messageTimestamp: 1_700_000_000,
      message: {
        extendedTextMessage: {
          text: "!ping",
          contextInfo: { mentionedJid: ["123456789@lid"] },
        },
      },
    };

    await socket.deliverRaw(raw);

    expect(received).toHaveLength(1);
    expect(received[0]?.mentionedUserIds).toEqual(["51900000001"]);
  });

  test("leaves a direct-chat LID jid alone with no matching remoteJidAlt", async () => {
    const { socket, received } = createReceiver();
    const raw: WAMessage = {
      key: {
        remoteJid: "123456789@lid",
        id: "msg-3",
        fromMe: false,
      },
      pushName: "Sender",
      messageTimestamp: 1_700_000_000,
      message: { conversation: "!ping" },
    };

    await socket.deliverRaw(raw);

    expect(received).toHaveLength(1);
    expect(received[0]?.senderId).toBe("123456789");
  });
});

describe("quoted media", () => {
  test("records a reply's quoted message under the quoted message's own id", async () => {
    const { socket, store } = createReceiver();
    const raw: WAMessage = {
      key: {
        remoteJid: "51900000004@s.whatsapp.net",
        id: "msg-6",
        fromMe: false,
      },
      pushName: "Sender",
      messageTimestamp: 1_700_000_000,
      message: {
        extendedTextMessage: {
          text: "!sticker",
          contextInfo: {
            stanzaId: "quoted-msg-1",
            quotedMessage: {
              imageMessage: { mimetype: "image/jpeg", fileLength: 1234 },
            },
          },
        },
      },
    };

    await socket.deliverRaw(raw);

    const quoted = store.get("quoted-msg-1");
    expect(quoted?.message?.imageMessage?.mimetype).toBe("image/jpeg");
  });
});

describe("messages.upsert filtering", () => {
  test("ignores batches that are not the live 'notify' type", async () => {
    const { socket, received } = createReceiver();
    const raw: WAMessage = {
      key: {
        remoteJid: "51900000002@s.whatsapp.net",
        id: "msg-4",
        fromMe: false,
      },
      pushName: "Sender",
      messageTimestamp: 1_700_000_000,
      message: { conversation: "!ping" },
    };

    await socket.deliverRaw(raw, "append");

    expect(received).toHaveLength(0);
  });

  test("status@broadcast is never a group even though it carries a participant", async () => {
    const { socket, received } = createReceiver();
    const raw: WAMessage = {
      key: {
        remoteJid: "status@broadcast",
        id: "msg-5",
        fromMe: false,
        participant: "51900000003@s.whatsapp.net",
      },
      pushName: "Sender",
      messageTimestamp: 1_700_000_000,
      message: { conversation: "!ping" },
    };

    await socket.deliverRaw(raw);

    expect(received).toHaveLength(1);
    expect(received[0]?.isGroup).toBe(false);
  });
});
