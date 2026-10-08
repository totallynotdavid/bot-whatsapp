import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test, vi } from "vitest";
import type { IncomingMessage, WhatsAppTransport } from "./index";

// A real file every adapter can read from disk when it sends media; its
// content is irrelevant, only that a real path exists.
const SAMPLE_FILE = fileURLToPath(import.meta.url);

// A minimal valid 1x1 transparent PNG, decoded to a real temp file so a
// sticker conversion has genuine image bytes to work with; SAMPLE_FILE above
// is this source file's own text and cannot be converted to an image.
const STICKER_SOURCE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const STICKER_SOURCE_FILE = join(
  mkdtempSync(join(tmpdir(), "wa-transport-test-")),
  "sticker-source.png"
);
writeFileSync(
  STICKER_SOURCE_FILE,
  Buffer.from(STICKER_SOURCE_PNG_BASE64, "base64")
);

// Checks the RIFF/WEBP container signature, the same way any WebP decoder
// identifies the format, without needing to decode pixel data.
function isWebp(buffer: Buffer | undefined): boolean {
  if (!buffer || buffer.length < 12) return false;
  return (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

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

  // The raw bytes of the last sendSticker call, so the contract can assert
  // it is actually WebP and not just that a call happened.
  stickerPayload(): Buffer | undefined;

  // "connected" / "disconnected" entries, recorded when the transport's own
  // connect()/disconnect() reach the fake library boundary.
  connectionEvents(): string[];

  // Makes the library end the session for good, as a revoked login does.
  endSession(): void;

  setGroup(chatId: string, participants: GroupFixtureParticipant[]): void;
  setMedia(messageId: string, media: MediaFixture): void;
  setProfilePic(userId: string, url: string): void;

  // Makes the next profile picture lookup for `userId` reject, as a real
  // failure (timeout, disconnect, ...) would, distinct from "no picture".
  failProfilePic(userId: string): void;

  // Makes sending a reaction to `messageId` fail even though the message is
  // known, so the "failure is swallowed" behavior is exercised by a real
  // failure and not just an unknown message id.
  failReaction(messageId: string): void;
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// A group jid, not just an opaque id: Baileys derives isGroup from its
// shape (isJidGroup), so a fixture that claims isGroup: true needs a chatId
// that actually looks like one.
const COMMAND: IncomingMessageInput = {
  chatId: "120363000000000000@g.us",
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
    test("connect and disconnect reach the underlying library", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();

      await transport.connect();
      expect(driver.connectionEvents()).toEqual(["connected"]);

      await transport.disconnect();
      expect(driver.connectionEvents()).toEqual(["connected", "disconnected"]);
    });

    test("onClose reports a session the library ended for good", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();
      const closed: Error[] = [];
      transport.onClose((error) => closed.push(error));
      await transport.connect();

      driver.endSession();

      await vi.waitFor(() => expect(closed).toHaveLength(1));
      expect(closed[0]).toBeInstanceOf(Error);
    });

    test("onClose stays silent when the app disconnected on purpose", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();
      const closed: Error[] = [];
      transport.onClose((error) => closed.push(error));
      await transport.connect();
      await transport.disconnect();

      driver.endSession();

      expect(closed).toEqual([]);
    });

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

    test("onMessage honors an isCommand predicate, skipping conversion for the rest", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();
      const received: IncomingMessage[] = [];
      transport.onMessage(
        async (message) => {
          received.push(message);
        },
        (body) => body.startsWith(driver.commandPrefix)
      );

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
      await transport.sendSticker("chat-1", STICKER_SOURCE_FILE, "msg-1");

      expect(driver.sentEvents()).toEqual([
        "text:chat-1:hola",
        "media:chat-1:caption",
        "sticker:chat-1",
      ]);
      expect(isWebp(driver.stickerPayload())).toBe(true);
    });

    test("sendReaction failure on an unknown message is swallowed, not thrown", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();

      await expect(
        transport.sendReaction("missing-message", "👍")
      ).resolves.toBeUndefined();
    });

    test("sendReaction failure on a known message is also swallowed, not thrown", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();
      driver.setMedia("msg-react", { mimeType: "image/png", content: "png" });
      driver.failReaction("msg-react");

      await expect(
        transport.sendReaction("msg-react", "👍")
      ).resolves.toBeUndefined();
    });

    test("isGroupAdmin and removeParticipant use group membership", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();
      const chatId = "120363000000000001@g.us";
      driver.setGroup(chatId, [
        { userId: "51911111111", isAdmin: true },
        { userId: "51922222222", isAdmin: false },
      ]);

      expect(await transport.isGroupAdmin(chatId, "51911111111")).toBe(true);
      expect(await transport.isGroupAdmin(chatId, "51922222222")).toBe(false);
      expect(await transport.isGroupAdmin(chatId, "51999999999")).toBe(false);

      await transport.removeParticipant(chatId, "51922222222");
      const removals = driver
        .sentEvents()
        .filter((event) => event.startsWith(`remove:${chatId}:`));
      expect(removals).toEqual([`remove:${chatId}:51922222222`]);
    });

    test("isGroupAdmin and removeParticipant throw for a chat that is not a group", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();
      const directChatId = "51933333333@s.whatsapp.net";

      await expect(
        transport.isGroupAdmin(directChatId, "51911111111")
      ).rejects.toThrow("not a group");
      await expect(
        transport.removeParticipant(directChatId, "51911111111")
      ).rejects.toThrow("not a group");
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

    test("getProfilePicUrl rejects on a real failure, not just a missing picture", async () => {
      const driver = createDriver();
      const transport = driver.createTransport();
      driver.failProfilePic("51944444444");

      await expect(transport.getProfilePicUrl("51944444444")).rejects.toThrow(
        "profile picture lookup failed"
      );
    });
  });
}
