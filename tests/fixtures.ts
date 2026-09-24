import { existsSync, readFileSync } from "node:fs";
import type { Client, MessageMedia, MessageSendOptions } from "whatsapp-web.js";
import type { PostgresClient } from "../src/infrastructure/database/postgres";
import type { RedisClient } from "../src/infrastructure/database/redis";
import type { BookData, BookInfo } from "../src/domain/book";
import type { MediaInfo } from "../src/domain/media";
import type { JobName, JobPayload } from "../src/domain/job";
import type { CommandHandler } from "../src/domain/command";
import { CacheRepository } from "../src/infrastructure/database/repositories/cache-repository";
import type { BookCatalog } from "../src/application/ports/book-catalog";
import type { JobScheduler } from "../src/application/ports/job-scheduler";
import type {
  DownloadedMedia,
  MessageSender,
} from "../src/application/ports/message-sender";
import type { Message } from "../src/domain/message";
import { UserRepository } from "../src/infrastructure/database/repositories/user-repository";
import { GroupRepository } from "../src/infrastructure/database/repositories/group-repository";
import { PermissionChecker } from "../src/application/services/permission-checker";
import { UserService } from "../src/application/services/user-service";
import { CommandExecutor } from "../src/application/services/command-executor";
import { OwnerNotifier } from "../src/application/services/owner-notifier";
import { loadConfig } from "../src/config";

export const OWNER_PHONE = "51900000000";
export const REGULAR_PHONE = "51922222222";

// Initializes config so logger.ts and code paths that log can run. Load once per test file.
export function loadTestConfig(): void {
  loadConfig({
    OWNER_PHONE,
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_KEY: "x".repeat(32),
  });
}

loadTestConfig();

type PostgresFilter = { column: string; value: unknown };

// Implements the Postgres interface so tests run unmodified. Type-checks API compatibility.
export class FakePostgres implements Pick<
  PostgresClient,
  "queryOne" | "queryMany" | "upsert" | "update"
> {
  private readonly tables = new Map<string, Record<string, unknown>[]>();

  private rows(table: string): Record<string, unknown>[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  async queryOne<T>(
    table: string,
    _select: string,
    filter?: PostgresFilter
  ): Promise<T | null> {
    const rows = this.rows(table);
    const row = filter
      ? rows.find((r) => r[filter.column] === filter.value)
      : rows[0];
    return (row as T) ?? null;
  }

  async queryMany<T>(
    table: string,
    _select: string,
    filter?: PostgresFilter
  ): Promise<T[]> {
    const rows = this.rows(table);
    return (
      filter ? rows.filter((r) => r[filter.column] === filter.value) : rows
    ) as T[];
  }

  async upsert(
    table: string,
    data: unknown,
    conflictColumn: string
  ): Promise<void> {
    const record = data as Record<string, unknown>;
    const rows = this.rows(table);
    const idx = rows.findIndex(
      (r) => r[conflictColumn] === record[conflictColumn]
    );
    if (idx >= 0) rows[idx] = { ...rows[idx], ...record };
    else rows.push({ ...record });
  }

  async update(
    table: string,
    data: Record<string, unknown>,
    filter: PostgresFilter
  ): Promise<void> {
    const row = this.rows(table).find((r) => r[filter.column] === filter.value);
    if (row) Object.assign(row, data);
  }

  asPostgresClient(): PostgresClient {
    return this as unknown as PostgresClient;
  }
}

export class FakeWhatsAppSender implements MessageSender {
  readonly sentTo: string[] = [];
  // Texts and media in the order they were sent.
  readonly sendLog: string[] = [];
  readonly picUrls = new Map<string, string>();
  readonly groupMembers = new Map<string, Set<string>>();
  readonly groupAdmins = new Map<string, Set<string>>();
  readonly mediaInfos = new Map<string, MediaInfo>();
  private readonly failFor = new Set<string>();

  // Removal rejects for anyone who is not currently a member, as it does for
  // the real sender when the bot cannot remove that participant.
  async removeParticipant(chatId: string, userId: string): Promise<void> {
    if (!this.groupMembers.get(chatId)?.delete(userId)) {
      throw new Error(`cannot remove ${userId} from ${chatId}`);
    }
  }

  async isGroupAdmin(chatId: string, userId: string): Promise<boolean> {
    return this.groupAdmins.get(chatId)?.has(userId) ?? false;
  }

  async getMediaInfo(messageId: string): Promise<MediaInfo | null> {
    return this.mediaInfos.get(messageId) ?? null;
  }

  async downloadMedia(): Promise<DownloadedMedia | null> {
    return null;
  }

  async sendSticker(): Promise<void> {}

  async sendReaction(): Promise<void> {}

  failNext(chatId: string): void {
    this.failFor.add(chatId);
  }

  async sendText(chatId: string, text: string): Promise<void> {
    if (this.failFor.has(chatId)) {
      throw new Error(`simulated send failure for ${chatId}`);
    }
    this.sentTo.push(chatId);
    this.sendLog.push(`text: ${text}`);
  }

  async getProfilePicUrl(chatId: string): Promise<string | null> {
    return this.picUrls.get(chatId) ?? null;
  }

  readonly sentMedia: SentMedia[] = [];
  failMediaSends = false;

  // Records what was on disk at send time, as the real sender reads the
  // file before its send returns.
  async sendMedia(
    chatId: string,
    filePath: string,
    caption?: string,
    replyToMessageId?: string,
    sendAudioAsVoice?: boolean,
    sendVideoAsGif?: boolean
  ): Promise<void> {
    this.sendLog.push("media");
    this.sentMedia.push({
      chatId,
      filePath,
      caption,
      replyToMessageId,
      sendAudioAsVoice: sendAudioAsVoice ?? false,
      sendVideoAsGif: sendVideoAsGif ?? false,
      content: existsSync(filePath) ? readFileSync(filePath, "utf8") : null,
    });
    if (this.failMediaSends) throw new Error("simulated media send failure");
  }
}

export interface SentMedia {
  readonly chatId: string;
  readonly filePath: string;
  readonly caption: string | undefined;
  readonly replyToMessageId: string | undefined;
  readonly sendAudioAsVoice: boolean;
  readonly sendVideoAsGif: boolean;
  readonly content: string | null;
}

export interface FakeWhatsAppWebParticipant {
  readonly id: { readonly _serialized: string };
  readonly isAdmin: boolean;
  readonly isSuperAdmin: boolean;
}

export interface FakeWhatsAppWebMedia {
  readonly mimetype: string;
  readonly content: string;
}

// Mock whatsapp-web.js Client; real WhatsAppSender runs over it. Sends land in `events`.
export class FakeWhatsAppWebClient {
  readonly events: string[] = [];
  readonly media = new Map<string, FakeWhatsAppWebMedia>();
  readonly profilePics = new Map<string, string>();
  downloads = 0;
  downloadDelayMs = 0;
  failDownloads = 0;
  sendAttempts = 0;
  failSends = 0;
  lookupError?: Error;

  async getMessageById(messageId: string) {
    if (this.lookupError) throw this.lookupError;
    const media = this.media.get(messageId);
    return {
      hasMedia: media !== undefined,
      rawData: media && {
        size: Buffer.byteLength(media.content),
        mimetype: media.mimetype,
      },
      downloadMedia: async () => {
        this.downloads++;
        if (this.downloadDelayMs > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.downloadDelayMs)
          );
        }
        if (this.failDownloads > 0) {
          this.failDownloads--;
          throw new Error("simulated download failure");
        }
        return {
          mimetype: media!.mimetype,
          data: Buffer.from(media!.content).toString("base64"),
        };
      },
    };
  }

  async sendMessage(
    chatId: string,
    content: string | MessageMedia,
    options: MessageSendOptions = {}
  ): Promise<void> {
    this.sendAttempts++;
    if (this.failSends > 0) {
      this.failSends--;
      throw new Error("simulated send failure");
    }

    const replyTo = options.quotedMessageId;
    if (typeof content === "string") {
      this.events.push(`text to ${chatId} re ${replyTo}: ${content}`);
      return;
    }

    const body = Buffer.from(content.data, "base64").toString("utf8");
    this.events.push(
      options.sendMediaAsSticker
        ? `sticker to ${chatId} re ${replyTo}: ${body}`
        : `media to ${chatId} re ${replyTo}: ${body} caption=${options.caption} voice=${options.sendAudioAsVoice ?? false}`
    );
  }

  async getProfilePicUrl(userId: string): Promise<string | undefined> {
    if (this.lookupError) throw this.lookupError;
    return this.profilePics.get(userId);
  }

  readonly groups = new Map<string, FakeWhatsAppWebParticipant[]>();
  readonly removals: string[][] = [];
  failRemovals = 0;

  async getChatById(chatId: string) {
    if (this.lookupError) throw this.lookupError;
    const participants = this.groups.get(chatId);
    return {
      isGroup: participants !== undefined,
      participants,
      removeParticipants: async (ids: string[]) => {
        this.removals.push(ids);
        if (this.failRemovals > 0) {
          this.failRemovals--;
          throw new Error("simulated removal failure");
        }
        return { status: 200 };
      },
    };
  }

  asClient(): Client {
    return this as unknown as Client;
  }
}

export interface QueuedJob {
  readonly name: JobName;
  readonly payload: unknown;
}

export class FakeJobScheduler implements JobScheduler {
  readonly jobs: QueuedJob[] = [];

  async enqueue<N extends JobName>(
    name: N,
    payload: JobPayload<N>
  ): Promise<void> {
    this.jobs.push({ name, payload });
  }
}

// TTLs are ignored: no test here depends on expiry.
export class FakeRedis implements Pick<RedisClient, "get" | "set" | "delete"> {
  private readonly values = new Map<string, string>();

  async get<T>(key: string): Promise<T | null> {
    const raw = this.values.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }

  async set(key: string, value: unknown, _ttlSeconds: number): Promise<void> {
    this.values.set(key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  asCacheRepository(): CacheRepository {
    return new CacheRepository(this as unknown as RedisClient);
  }
}

export class FakeAnnasArchiveClient implements BookCatalog {
  readonly searches: string[] = [];
  readonly bookInfoRequests: string[] = [];
  results: BookData[] = [];
  bookInfos = new Map<string, BookInfo>();

  async searchBooks(query: string, _limit = 5): Promise<BookData[]> {
    this.searches.push(query);
    return this.results;
  }

  async getBookInfo(url: string): Promise<BookInfo | null> {
    this.bookInfoRequests.push(url);
    return this.bookInfos.get(url) ?? null;
  }
}

export interface BotDeps {
  readonly postgres: PostgresClient;
  readonly userRepo: UserRepository;
  readonly groupRepo: GroupRepository;
  readonly userService: UserService;
  readonly executor: CommandExecutor;
  readonly sender: FakeWhatsAppSender;
}

// Wires services; tests inject commands to register.
export function makeBot(
  commands: (deps: BotDeps) => readonly CommandHandler[] = () => []
) {
  const postgres = new FakePostgres().asPostgresClient();
  const userRepo = new UserRepository(postgres);
  const groupRepo = new GroupRepository(postgres);
  const permissionChecker = new PermissionChecker(OWNER_PHONE);
  const userService = new UserService(userRepo, OWNER_PHONE);
  const sender = new FakeWhatsAppSender();
  const executor = new CommandExecutor(
    userService,
    permissionChecker,
    groupRepo,
    new OwnerNotifier(sender, OWNER_PHONE),
    "/"
  );

  const deps: BotDeps = {
    postgres,
    userRepo,
    groupRepo,
    userService,
    executor,
    sender,
  };
  for (const command of commands(deps)) executor.registerCommand(command);
  return deps;
}

const FIXED_MESSAGE_ID = "msg-fixed";
const FIXED_TIMESTAMP = new Date("2024-01-01T00:00:00.000Z");

export function makeMessage(
  overrides: Partial<Message> &
    Pick<Message, "senderId" | "chatId" | "isGroup" | "body">
): Message {
  return {
    id: FIXED_MESSAGE_ID,
    senderName: "Tester",
    timestamp: FIXED_TIMESTAMP,
    hasMedia: false,
    mentionedUserIds: [],
    ...overrides,
  };
}

export function dm(
  senderId: string,
  body: string,
  extra: Partial<Message> = {}
): Message {
  return makeMessage({
    senderId,
    chatId: `${senderId}@c.us`,
    isGroup: false,
    body,
    ...extra,
  });
}

export function inGroup(
  senderId: string,
  groupId: string,
  body: string,
  extra: Partial<Message> = {}
): Message {
  return makeMessage({
    senderId,
    chatId: groupId,
    isGroup: true,
    body,
    ...extra,
  });
}
