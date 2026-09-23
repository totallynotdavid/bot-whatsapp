import { describe, expect, test, vi } from "vitest";
import { WhatsAppClient } from "../src/infrastructure/whatsapp/client";
import {
  RetryingWhatsAppSender,
  WhatsAppSender,
} from "../src/infrastructure/whatsapp/sender";
import { FakeWhatsAppWebClient } from "./fixtures";

const CHAT_ID = "51922222222@c.us";

function setup() {
  const client = new FakeWhatsAppWebClient();
  client.media.set("msg-media", { mimetype: "image/png", content: "png" });
  return { client, sender: new WhatsAppSender(client.asClient()) };
}

describe("WhatsAppSender", () => {
  test("a failed send is attempted once and throws", async () => {
    const { client, sender } = setup();
    client.failSends = 1;

    await expect(sender.sendText(CHAT_ID, "hola")).rejects.toThrow(
      "simulated send failure"
    );
    expect(client.sendAttempts).toBe(1);
  });

  test("media info comes from a single download", async () => {
    const { client, sender } = setup();

    expect(await sender.getMediaInfo("msg-media")).toEqual({
      sizeBytes: 3,
      mimeType: "image/png",
    });
    expect(client.downloads).toBe(1);
  });

  test("a message without media has no media info", async () => {
    const { sender } = setup();

    expect(await sender.getMediaInfo("msg-text")).toBeNull();
  });

  test("a failed media lookup throws instead of reporting no media", async () => {
    const { client, sender } = setup();
    client.lookupError = new Error("page crashed");

    await expect(sender.getMediaInfo("msg-media")).rejects.toThrow(
      "page crashed"
    );
  });

  test("an aborted signal stops a download before it starts", async () => {
    const { client, sender } = setup();
    const controller = new AbortController();
    controller.abort(new Error("job timed out"));

    await expect(
      sender.downloadMedia("msg-media", controller.signal)
    ).rejects.toThrow("job timed out");
    expect(client.downloads).toBe(0);
  });

  test("a failed profile picture lookup throws; a missing one is null", async () => {
    const { client, sender } = setup();

    expect(await sender.getProfilePicUrl(CHAT_ID)).toBeNull();

    client.lookupError = new Error("page crashed");
    await expect(sender.getProfilePicUrl(CHAT_ID)).rejects.toThrow(
      "page crashed"
    );
  });
});

describe("RetryingWhatsAppSender", () => {
  test("retries a failed send for replies nothing else retries", async () => {
    const client = new FakeWhatsAppWebClient();
    client.failSends = 1;

    await new RetryingWhatsAppSender(client.asClient()).sendText(
      CHAT_ID,
      "hola",
      "msg-1"
    );

    expect(client.sendAttempts).toBe(2);
    expect(client.events).toEqual([`text to ${CHAT_ID} re msg-1: hola`]);
  });
});

describe("WhatsAppClient", () => {
  test("close() destroys the whatsapp-web.js client and its browser", async () => {
    const whatsapp = new WhatsAppClient();
    const destroy = vi
      .spyOn(whatsapp.getClient(), "destroy")
      .mockResolvedValue(undefined);

    await whatsapp.close();

    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
