import { DisconnectReason, type WAMessage } from "@whiskeysockets/baileys";
import {
  describeTransportContract,
  type TransportTestDriver,
} from "@bot-whatsapp/whatsapp/testing";
import { MessageStore } from "../src/message-store";
import { ReconnectingBaileysSocket } from "../src/reconnecting-socket";
import { createBaileysConnection } from "../src/session";
import { BaileysTransport } from "../src/transport";
import { FakeBaileysSocket, FakeRawSocket, silentLogger } from "./fixtures";

// The library's socket: it opens as soon as it is built, and ending it closes
// it with a connection-closed status, as the real one does.
class LibrarySocket extends FakeRawSocket {
  constructor(private readonly events: string[]) {
    super();
    this.events.push("connected");
    queueMicrotask(() => this.emitOpen());
  }

  override async end(): Promise<void> {
    this.events.push("disconnected");
    this.emitClose(DisconnectReason.connectionClosed);
  }
}

function createDriver(): TransportTestDriver {
  const socket = new FakeBaileysSocket();
  const store = new MessageStore();
  const mediaContent = new Map<string, string>();
  const connectionEvents: string[] = [];

  // The connection is the adapter's own, down to manageConnection; only the
  // library underneath is fake, so no test opens a real connection.
  let rawSocket: LibrarySocket | undefined;
  const connection = createBaileysConnection(
    new ReconnectingBaileysSocket(),
    async () => ({
      saveCreds: () => {},
      clearCredentials: async () => {},
      buildSocket: () => {
        rawSocket = new LibrarySocket(connectionEvents);
        return rawSocket;
      },
    }),
    silentLogger
  );

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
    endSession: () => rawSocket?.emitClose(DisconnectReason.loggedOut),
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
