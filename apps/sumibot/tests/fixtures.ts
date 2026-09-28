import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  DownloadedMedia,
  IncomingMessage,
  Logger,
  LogLevel,
  MediaInfo,
  WhatsAppTransport,
} from "@bot-whatsapp/whatsapp";
import type { CommandDeps } from "../src/application/command-deps";
import type { AttendanceStore } from "../src/application/ports/attendance-store";
import type { EventLog } from "../src/application/ports/event-log";
import type {
  DownloadedImage,
  ImageDownloader,
  PhotoStorage,
} from "../src/application/ports/photo-storage";
import type {
  AttendanceAction,
  AttendanceEvent,
  AttendanceRecord,
  OpeningPhoto,
} from "../src/domain/attendance";

export const OWNER_PHONE = "51900000000";
export const LIBRARIAN_PHONE = "51911111111";
export const GROUP_CHAT = "120363000000000000@g.us";

export function makeMessage(
  overrides: Partial<IncomingMessage> = {}
): IncomingMessage {
  return {
    id: "msg-1",
    chatId: GROUP_CHAT,
    senderId: LIBRARIAN_PHONE,
    senderName: "Ana",
    body: "",
    timestamp: new Date("2025-03-10T14:00:00Z"),
    isGroup: true,
    groupName: "Biblioteca",
    hasMedia: false,
    mentionedUserIds: [],
    ...overrides,
  };
}

export function makePhotoMessage(
  body: string,
  overrides: Partial<IncomingMessage> = {}
): IncomingMessage {
  return makeMessage({
    body,
    hasMedia: true,
    mediaType: "image",
    ...overrides,
  });
}

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly metadata?: Record<string, unknown>;
}

export function recordingLogger(): { log: Logger; entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  return {
    entries,
    log: (level, message, metadata) => {
      entries.push({ level, message, metadata });
    },
  };
}

export interface SentText {
  readonly chatId: string;
  readonly text: string;
}

export interface SentMedia {
  readonly chatId: string;
  readonly filePath: string;
  readonly caption?: string;
  readonly content: string;
}

export interface Reaction {
  readonly messageId: string;
  readonly emoji: string;
}

// A WhatsAppTransport with no library behind it: nothing here can reach
// WhatsApp. It records what the app sends and lets a test deliver messages
// as an adapter would.
export class FakeTransport implements WhatsAppTransport {
  readonly texts: SentText[] = [];
  readonly media: SentMedia[] = [];
  readonly reactions: Reaction[] = [];
  readonly events: string[] = [];
  private handler?: (message: IncomingMessage) => Promise<void>;
  private isCommand?: (body: string) => boolean;
  private readonly downloads = new Map<string, DownloadedMedia>();
  private sendFailures = 0;

  toChatId(phoneNumber: string): string {
    return `${phoneNumber}@s.whatsapp.net`;
  }

  async sendText(chatId: string, text: string): Promise<void> {
    this.failIfScheduled();
    this.texts.push({ chatId, text });
  }

  async sendMedia(
    chatId: string,
    filePath: string,
    caption?: string
  ): Promise<void> {
    this.failIfScheduled();
    this.media.push({
      chatId,
      filePath,
      caption,
      content: (await readFile(filePath)).toString(),
    });
  }

  async sendSticker(): Promise<void> {
    throw new Error("Not used by SumiBot");
  }

  async sendReaction(messageId: string, emoji: string): Promise<void> {
    this.reactions.push({ messageId, emoji });
  }

  async removeParticipant(): Promise<void> {
    throw new Error("Not used by SumiBot");
  }

  async isGroupAdmin(): Promise<boolean> {
    return false;
  }

  async getMediaInfo(messageId: string): Promise<MediaInfo | null> {
    return this.downloads.get(messageId) ?? null;
  }

  async downloadMedia(messageId: string): Promise<DownloadedMedia | null> {
    return this.downloads.get(messageId) ?? null;
  }

  async getProfilePicUrl(): Promise<string | null> {
    return null;
  }

  async connect(): Promise<void> {
    this.events.push("connect");
  }

  onMessage(
    handler: (message: IncomingMessage) => Promise<void>,
    isCommand?: (body: string) => boolean
  ): void {
    this.events.push("onMessage");
    this.handler = handler;
    this.isCommand = isCommand;
  }

  async stopReceiving(): Promise<void> {
    this.events.push("stopReceiving");
    this.handler = undefined;
  }

  async disconnect(): Promise<void> {
    this.events.push("disconnect");
  }

  attachMedia(messageId: string, content: string): void {
    this.downloads.set(messageId, {
      buffer: Buffer.from(content),
      sizeBytes: content.length,
      mimeType: "image/jpeg",
    });
  }

  // The next `count` sends fail, as a dropped connection would make them.
  failNextSends(count: number): void {
    this.sendFailures = count;
  }

  // Delivers `message` like an adapter: nothing is handled before
  // onMessage registers a handler, or when the isCommand filter rejects it.
  async deliver(message: IncomingMessage): Promise<void> {
    if (!this.handler) return;
    if (this.isCommand && !this.isCommand(message.body)) return;
    await this.handler(message);
  }

  private failIfScheduled(): void {
    if (this.sendFailures > 0) {
      this.sendFailures--;
      throw new Error("connection closed");
    }
  }
}

export class FakeAttendanceStore implements AttendanceStore {
  // What the app recorded, apart from what a test seeded.
  readonly records: AttendanceRecord[] = [];
  readonly librarians = new Map<string, string>();
  private readonly seeded: AttendanceRecord[] = [];
  failReads = false;
  failLibrarianLookups = false;

  async record(entry: AttendanceRecord): Promise<void> {
    this.records.push(entry);
    this.seeded.push(entry);
  }

  // Test setup, not a call the app makes.
  seed(entry: AttendanceRecord): void {
    this.seeded.push(entry);
  }

  async latest(action: AttendanceAction): Promise<AttendanceEvent | null> {
    if (this.failReads) throw new Error("database down");
    const matching = this.seeded
      .filter((entry) => entry.action === action)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return matching[0] ?? null;
  }

  async openingsBetween(from: Date, to: Date): Promise<OpeningPhoto[]> {
    if (this.failReads) throw new Error("database down");
    return this.seeded
      .filter(
        (entry) =>
          entry.action === "open" &&
          entry.timestamp >= from &&
          entry.timestamp <= to
      )
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async librarianName(managerNumber: string): Promise<string | null> {
    if (this.failLibrarianLookups) throw new Error("database down");
    return this.librarians.get(managerNumber) ?? null;
  }
}

export class FakePhotoStorage implements PhotoStorage {
  readonly uploads: { managerNumber: string; content: string }[] = [];
  fail = false;

  async upload(managerNumber: string, photo: Buffer): Promise<string> {
    if (this.fail) throw new Error("storage down");
    this.uploads.push({ managerNumber, content: photo.toString() });
    return `https://files.example/${managerNumber}/${this.uploads.length}.jpg`;
  }
}

// Serves image content by URL from memory and tracks each temp file it made.
export class FakeImageDownloader implements ImageDownloader {
  readonly contents = new Map<string, string>();
  readonly disposed: string[] = [];
  private counter = 0;

  async download(url: string): Promise<DownloadedImage> {
    const content = this.contents.get(url);
    if (content === undefined) throw new Error(`no image at ${url}`);

    const directory = await mkdtemp(join(tmpdir(), "sumibot-test-"));
    const filePath = join(directory, `image-${this.counter++}.jpg`);
    await writeFile(filePath, content);

    return {
      filePath,
      dispose: async () => {
        this.disposed.push(filePath);
        await rm(directory, { recursive: true, force: true });
      },
    };
  }
}

export class FakeEventLog implements EventLog {
  readonly usages: Parameters<EventLog["commandUsed"]>[0][] = [];
  readonly failures: Parameters<EventLog["failed"]>[0][] = [];
  failWrites = false;

  async commandUsed(entry: Parameters<EventLog["commandUsed"]>[0]) {
    if (this.failWrites) throw new Error("database down");
    this.usages.push(entry);
  }

  async failed(entry: Parameters<EventLog["failed"]>[0]) {
    if (this.failWrites) throw new Error("database down");
    this.failures.push(entry);
  }
}

export interface World {
  readonly transport: FakeTransport;
  readonly attendance: FakeAttendanceStore;
  readonly photos: FakePhotoStorage;
  readonly images: FakeImageDownloader;
  readonly events: FakeEventLog;
  readonly logs: LogEntry[];
  readonly deps: CommandDeps;
  clock: Date;
}

export function makeWorld(): World {
  const transport = new FakeTransport();
  const attendance = new FakeAttendanceStore();
  const photos = new FakePhotoStorage();
  const images = new FakeImageDownloader();
  const events = new FakeEventLog();
  const { log, entries } = recordingLogger();
  const world: World = {
    transport,
    attendance,
    photos,
    images,
    events,
    logs: entries,
    clock: new Date(2025, 2, 10, 9, 5),
    deps: {
      sender: transport,
      attendance,
      photos,
      images,
      log,
      now: () => world.clock,
    },
  };
  return world;
}
