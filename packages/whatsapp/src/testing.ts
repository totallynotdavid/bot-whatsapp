import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { IncomingMessage, WhatsAppTransport } from "./index";

// A real file every adapter can read from disk when it sends media; its
// content is irrelevant, only that a real path exists.
const SAMPLE_FILE = fileURLToPath(import.meta.url);

export interface IncomingMessageInput {
  readonly chatId: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly body: string;
  readonly isGroup: boolean;
  readonly mentionedUserIds?: string[];
}

export interface GroupFixtureParticipant {
  readonly userId: string;
  readonly isAdmin: boolean;
}

export interface MediaFixture {
  readonly mimeType: string;
  readonly content: string;
}

// A driver adapts one library's fake to this shape, so the same assertions
// run against every adapter. Everything here fakes the library at its
// boundary: nothing connects to WhatsApp.
export interface TransportTestDriver {
  readonly commandPrefix: string;

  createTransport(): WhatsAppTransport;

  // Delivers `input` as the underlying library would, and resolves once
  // every handler registered through `onMessage` has settled.
  deliverMessage(input: IncomingMessageInput): Promise<void>;

  // Outbound calls the fake library recorded, one entry per call, in the
  // order they happened.
  sentEvents(): string[];

  setGroup(chatId: string, participants: GroupFixtureParticipant[]): void;
  setMedia(messageId: string, media: MediaFixture): void;
  setProfilePic(userId: string, url: string): void;
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const COMMAND: IncomingMessageInput = {
  chatId: "chat-1",
  senderId: "51911111111",
  senderName: "Ana",
  body: "",
  isGroup: true,
  mentionedUserIds: ["51922222222"],
};

// Runs the same suite against `createDriver()`'s transport. Call this once
// per adapter package, each with its own driver.
export function describeTransportContract(
  name: string,
  createDriver: () => TransportTestDriver
): void {
  describe(`${name}: WhatsAppTransport contract`, () => {
    test("toChatId maps a phone number to a usable, distinct chat id", () => {
      const driver = createDriver();
      const transport = driver.createTransport();

      const chatId = transport.toChatId("51900000000");

      expect(typeof chatId).toBe("string");
      expect(chatId).not.toBe("51900000000");
      expect(chatId).toContain("51900000000");
    });

    test("onMessage delivers a command with the fields commands need", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();
      const received: IncomingMessage[] = [];
      transport.onMessage(async (message) => {
        received.push(message);
      });

      await driver.deliverMessage({
        ...COMMAND,
        body: `${driver.commandPrefix}ping now`,
      });

      expect(received).toHaveLength(1);
      const message = received[0]!;
      expect(message.chatId).toBe(COMMAND.chatId);
      expect(message.senderId).toBe(COMMAND.senderId);
      expect(message.senderName).toBe(COMMAND.senderName);
      expect(message.body).toBe(`${driver.commandPrefix}ping now`);
      expect(message.isGroup).toBe(true);
      expect(message.mentionedUserIds).toEqual(COMMAND.mentionedUserIds);
      expect(message.hasMedia).toBe(false);
      expect(typeof message.id).toBe("string");
      expect(message.id.length).toBeGreaterThan(0);
      expect(message.timestamp).toBeInstanceOf(Date);
    });

    test("onMessage ignores a message that is not a command", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();
      const received: IncomingMessage[] = [];
      transport.onMessage(async (message) => {
        received.push(message);
      });

      await driver.deliverMessage({ ...COMMAND, body: "hello everyone" });

      expect(received).toEqual([]);
    });

    test("stopReceiving stops taking messages and waits for the ones in flight", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();
      let release = () => {};
      const started = new Promise<void>((resolveStarted) => {
        transport.onMessage(async () => {
          resolveStarted();
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        });
      });

      const delivering = driver.deliverMessage({
        ...COMMAND,
        body: `${driver.commandPrefix}ping`,
      });
      await started;

      let stopped = false;
      const stopping = transport.stopReceiving().then(() => {
        stopped = true;
        return stopped;
      });
      await flushMicrotasks();
      expect(stopped).toBe(false);

      release();
      await Promise.all([delivering, stopping]);
      expect(stopped).toBe(true);
    });

    test("sendText, sendMedia and sendSticker reach the underlying library", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();

      await transport.sendText("chat-1", "hola", "msg-1");
      await transport.sendMedia("chat-1", SAMPLE_FILE, "caption", "msg-1");
      await transport.sendSticker("chat-1", SAMPLE_FILE, "msg-1");

      expect(driver.sentEvents()).toEqual([
        "text:chat-1:hola",
        "media:chat-1:caption",
        "sticker:chat-1",
      ]);
    });

    test("sendReaction failure is swallowed, not thrown", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();

      await expect(
        transport.sendReaction("missing-message", "👍")
      ).resolves.toBeUndefined();
    });

    test("isGroupAdmin and removeParticipant use group membership", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();
      driver.setGroup("group-1", [
        { userId: "51911111111", isAdmin: true },
        { userId: "51922222222", isAdmin: false },
      ]);

      expect(await transport.isGroupAdmin("group-1", "51911111111")).toBe(true);
      expect(await transport.isGroupAdmin("group-1", "51922222222")).toBe(
        false
      );
      expect(await transport.isGroupAdmin("group-1", "51999999999")).toBe(
        false
      );

      await transport.removeParticipant("group-1", "51922222222");
      expect(driver.sentEvents()).toContain("remove:group-1:51922222222");
    });

    test("getMediaInfo and downloadMedia are null without media, populated with it", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();
      driver.setMedia("msg-media", { mimeType: "image/png", content: "png" });

      expect(await transport.getMediaInfo("msg-text")).toBeNull();
      expect(await transport.downloadMedia("msg-text")).toBeNull();

      expect(await transport.getMediaInfo("msg-media")).toEqual({
        sizeBytes: 3,
        mimeType: "image/png",
      });
      const downloaded = await transport.downloadMedia("msg-media");
      expect(downloaded).not.toBeNull();
      expect(downloaded!.mimeType).toBe("image/png");
      expect(downloaded!.buffer.toString()).toBe("png");
    });

    test("getProfilePicUrl is null without a picture, the url with one", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();

      expect(await transport.getProfilePicUrl("51911111111")).toBeNull();

      driver.setProfilePic("51911111111", "https://example.com/pic.jpg");
      expect(await transport.getProfilePicUrl("51911111111")).toBe(
        "https://example.com/pic.jpg"
      );
    });
  });
}
