import type { WAMessage } from "@whiskeysockets/baileys";
import {
  describeTransportContract,
  type TransportTestDriver,
} from "@bot-whatsapp/whatsapp/testing";
import { MessageStore } from "../src/message-store";
import { BaileysTransport, type BaileysConnection } from "../src/transport";
import { FakeBaileysSocket, silentLogger } from "./fixtures";

function createDriver(): TransportTestDriver {
  const socket = new FakeBaileysSocket();
  const store = new MessageStore();
  const mediaContent = new Map<string, string>();
  const connectionEvents: string[] = [];

  // Fully fake: connect()/disconnect() never touch the library, matching
  // the hard rule that no test opens a real connection.
  const connection: BaileysConnection = {
    connect: async () => {
      connectionEvents.push("connected");
    },
    disconnect: async () => {
      connectionEvents.push("disconnected");
    },
  };

  return {
    commandPrefix: "!",
    createTransport: () =>
      new BaileysTransport(
        connection,
        socket,
        async (message) =>
          Buffer.from(mediaContent.get(message.key.id ?? "") ?? ""),
        silentLogger,
        store
      ),
    deliverMessage: (input) => socket.deliverMessage(input),
    sentEvents: () => socket.events,
    stickerPayload: () => socket.lastStickerPayload,
    connectionEvents: () => connectionEvents,
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
    failProfilePic: (userId) => socket.failProfilePic(userId),
    failReaction: (messageId) => socket.failReaction(messageId),
  };
}

describeTransportContract("baileys", createDriver);
