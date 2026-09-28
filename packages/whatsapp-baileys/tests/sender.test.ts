import { describe, expect, test } from "vitest";
import { MessageStore } from "../src/message-store";
import { BaileysSender } from "../src/sender";
import { FakeBaileysSocket, silentLogger } from "./fixtures";

function createSender(): { socket: FakeBaileysSocket; sender: BaileysSender } {
  const socket = new FakeBaileysSocket();
  const sender = new BaileysSender(
    socket,
    new MessageStore(),
    async () => Buffer.from(""),
    silentLogger
  );
  return { socket, sender };
}

describe("BaileysSender.getProfilePicUrl", () => {
  test("a not-found stanza error (404) means no visible picture", async () => {
    const { socket, sender } = createSender();
    socket.failProfilePicWithStanzaCode("51955555555", 404);

    await expect(sender.getProfilePicUrl("51955555555")).resolves.toBeNull();
  });

  test("a not-authorized stanza error (401, hidden by privacy settings) means no visible picture", async () => {
    const { socket, sender } = createSender();
    socket.failProfilePicWithStanzaCode("51966666666", 401);

    await expect(sender.getProfilePicUrl("51966666666")).resolves.toBeNull();
  });

  test("any other stanza error code rejects, not just item-not-found/not-authorized", async () => {
    const { socket, sender } = createSender();
    socket.failProfilePicWithStanzaCode("51977777777", 500);

    await expect(sender.getProfilePicUrl("51977777777")).rejects.toThrow(
      "stanza error"
    );
  });
});
