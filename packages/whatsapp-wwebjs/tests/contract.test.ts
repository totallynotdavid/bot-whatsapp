import {
  describeTransportContract,
  type TransportTestDriver,
} from "@bot-whatsapp/whatsapp/testing";
import { WwebjsTransport } from "../src/transport";
import { FakeWwebjsClient } from "./fixtures";

function createDriver(): TransportTestDriver {
  const client = new FakeWwebjsClient();
  return {
    commandPrefix: "!",
    createTransport: () => new WwebjsTransport(client.asClient(), "!"),
    deliverMessage: (input) => client.deliverMessage(input),
    sentEvents: () => client.events,
    setGroup: (chatId, participants) => client.setGroup(chatId, participants),
    setMedia: (messageId, media) => client.setMedia(messageId, media),
    setProfilePic: (userId, url) => client.setProfilePic(userId, url),
  };
}

describeTransportContract("wwebjs", createDriver);
