import {
  describeTransportContract,
  type TransportTestDriver,
} from "@bot-whatsapp/whatsapp/testing";
import { WwebjsTransport } from "../src/transport";
import { FakeWwebjsClient, silentLogger } from "./fixtures";

function createDriver(): TransportTestDriver {
  const client = new FakeWwebjsClient();
  return {
    commandPrefix: "!",
    createTransport: () => new WwebjsTransport(client.asClient(), silentLogger),
    deliverMessage: (input) => client.deliverMessage(input),
    sentEvents: () => client.events,
    stickerPayload: () => client.lastStickerPayload,
    connectionEvents: () => client.connectionEvents,
    endSession: () => {
      client.emit("disconnected", "LOGOUT");
    },
    setGroup: (chatId, participants) => client.setGroup(chatId, participants),
    setMedia: (messageId, media) => client.setMedia(messageId, media),
    setProfilePic: (userId, url) => client.setProfilePic(userId, url),
    failProfilePic: (userId) => client.failProfilePic(userId),
    failReaction: (messageId) => client.failReaction(messageId),
  };
}

describeTransportContract("wwebjs", createDriver);
