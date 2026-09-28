import type { WAMessage } from "@whiskeysockets/baileys";
import {
  describeTransportContract,
  type TransportTestDriver,
} from "@bot-whatsapp/whatsapp/testing";
import { MessageStore } from "../src/message-store";
import { BaileysTransport, type BaileysConnection } from "../src/transport";
import { FakeBaileysSocket } from "./fixtures";

const NEVER_CALLED: BaileysConnection = {
  connect: () =>
    Promise.reject(new Error("not exercised by the contract suite")),
  disconnect: () =>
    Promise.reject(new Error("not exercised by the contract suite")),
};

function createDriver(): TransportTestDriver {
  const socket = new FakeBaileysSocket();
  const store = new MessageStore();
  const mediaContent = new Map<string, string>();

  return {
    commandPrefix: "!",
    createTransport: () =>
      new BaileysTransport(
        NEVER_CALLED,
        socket,
        "!",
        async (message) =>
          Buffer.from(mediaContent.get(message.key.id ?? "") ?? ""),
        store
      ),
    deliverMessage: (input) => socket.deliverMessage(input),
    sentEvents: () => socket.events,
    setGroup: (chatId, participants) => socket.setGroup(chatId, participants),
    setMedia: (messageId, media) => {
      const message: WAMessage = {
        key: { remoteJid: "chat-1", id: messageId, fromMe: false },
        message: {
          imageMessage: {
            mimetype: media.mimeType,
            fileLength: media.content.length,
          },
        },
      };
      store.record(message);
      mediaContent.set(messageId, media.content);
    },
    setProfilePic: (userId, url) => socket.setProfilePic(userId, url),
  };
}

describeTransportContract("baileys", createDriver);
