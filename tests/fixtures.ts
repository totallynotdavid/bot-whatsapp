import type { PostgresClient } from "../src/infrastructure/database/postgres";
import type { WhatsAppSender } from "../src/infrastructure/whatsapp/sender";
import type { RedisClient } from "../src/infrastructure/database/redis";
import type { QueueClient } from "../src/infrastructure/queue/client";
import type {
  AnnasArchiveClient,
  BookData,
  BookInfo,
} from "../src/infrastructure/external/annas-archive-client";
import type { JobData } from "../src/domain/job";
import type { CommandHandler } from "../src/domain/command";
import { CacheRepository } from "../src/infrastructure/database/repositories/cache-repository";
import { JobScheduler } from "../src/application/services/job-scheduler";
import type { Message } from "../src/domain/message";
import { UserRepository } from "../src/infrastructure/database/repositories/user-repository";
import { GroupRepository } from "../src/infrastructure/database/repositories/group-repository";
import { PermissionChecker } from "../src/application/services/permission-checker";
import { UserService } from "../src/application/services/user-service";
import { CommandExecutor } from "../src/application/services/command-executor";
import { loadConfig } from "../src/config";

export const OWNER_PHONE = "51900000000";
export const REGULAR_PHONE = "51922222222";

// src/lib/logging/logger.ts reads getConfig(), which throws until
// loadConfig() has run once. Every test file imports this module, so
// loading a fake config here (without overwriting a real one, if present)
// keeps command paths that log free to run without each test file
// repeating this setup.
process.env["OWNER_PHONE"] ??= OWNER_PHONE;
process.env["SUPABASE_URL"] ??= "https://example.supabase.co";
process.env["SUPABASE_KEY"] ??= "x".repeat(32);
loadConfig();

type PostgresFilter = { column: string; value: unknown };

// Repositories use the same query/filter shape against this fake and the real
// Supabase client, so tests can run unmodified. The `implements` clause makes
// a change to the real client's surface a type error here.
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

// Implements only the WhatsAppSender methods commands under test call.
export class FakeWhatsAppSender {
  readonly sentTo: string[] = [];
  readonly picUrls = new Map<string, string>();
  readonly groupMembers = new Map<string, Set<string>>();
  readonly mediaInfos = new Map<
    string,
    { sizeBytes: number; mimeType: string }
  >();
  private readonly failFor = new Set<string>();

  // Removal fails for anyone who is not currently a member, as it does for
  // the real sender when the bot cannot remove that participant.
  async removeParticipant(chatId: string, userId: string): Promise<boolean> {
    return this.groupMembers.get(chatId)?.delete(userId) ?? false;
  }

  async getMediaInfo(
    messageId: string
  ): Promise<{ sizeBytes: number; mimeType: string } | null> {
    return this.mediaInfos.get(messageId) ?? null;
  }

  failNext(chatId: string): void {
    this.failFor.add(chatId);
  }

  async sendText(chatId: string, _text: string): Promise<void> {
    if (this.failFor.has(chatId)) {
      throw new Error(`simulated send failure for ${chatId}`);
    }
    this.sentTo.push(chatId);
  }

  async getProfilePicUrl(chatId: string): Promise<string | null> {
    return this.picUrls.get(chatId) ?? null;
  }

  asWhatsAppSender(): WhatsAppSender {
    return this as unknown as WhatsAppSender;
  }
}

export interface QueuedJob {
  readonly type: string;
  readonly data: JobData;
  readonly priority: number | undefined;
}

// JobScheduler runs unmodified over this fake, so tests observe which queue
// and priority a command's job lands on.
export class FakeQueue implements Pick<QueueClient, "addJob"> {
  readonly jobs: QueuedJob[] = [];

  async addJob(type: string, data: JobData, priority?: number): Promise<void> {
    this.jobs.push({ type, data, priority });
  }

  asJobScheduler(): JobScheduler {
    return new JobScheduler(this as unknown as QueueClient);
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

export class FakeAnnasArchiveClient {
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

  asAnnasArchiveClient(): AnnasArchiveClient {
    return this as unknown as AnnasArchiveClient;
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

// The only place that knows how the services are wired together; tests say
// which commands they register.
export function makeBot(
  commands: (deps: BotDeps) => readonly CommandHandler[] = () => []
) {
  const postgres = new FakePostgres().asPostgresClient();
  const userRepo = new UserRepository(postgres);
  const groupRepo = new GroupRepository(postgres);
  const permissionChecker = new PermissionChecker(OWNER_PHONE);
  const userService = new UserService(userRepo, OWNER_PHONE);
  const executor = new CommandExecutor(
    userService,
    permissionChecker,
    groupRepo,
    "/"
  );
  const sender = new FakeWhatsAppSender();

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
