import type { PostgresClient } from "../src/infrastructure/database/postgres";
import type { WhatsAppSender } from "../src/infrastructure/whatsapp/sender";
import type { CommandHandler } from "../src/domain/command";
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
  private readonly failFor = new Set<string>();

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
