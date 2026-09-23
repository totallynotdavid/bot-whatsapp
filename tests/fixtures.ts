import type { PostgresClient } from "../src/infrastructure/database/postgres";
import type { RedisClient } from "../src/infrastructure/database/redis";
import type { Message } from "../src/domain/message";
import { loadConfig } from "../src/config";

// src/lib/logging/logger.ts reads getConfig(), which throws until
// loadConfig() has run once. Every test file imports this module, so
// loading a fake config here (without overwriting a real one, if present)
// keeps command paths that log free to run without each test file
// repeating this setup.
process.env["OWNER_PHONE"] ??= "51900000000";
process.env["SUPABASE_URL"] ??= "https://example.supabase.co";
process.env["SUPABASE_KEY"] ??= "x".repeat(32);
loadConfig();

// Repositories use the same query/filter shape against this fake and the real
// Supabase client, so tests can run unmodified.
export class FakePostgres {
  private readonly tables = new Map<string, Record<string, unknown>[]>();

  private rows(table: string): Record<string, unknown>[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  async queryOne<T>(
    table: string,
    _select: string,
    filter?: { column: string; value: unknown }
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
    filter?: { column: string; value: unknown }
  ): Promise<T[]> {
    const rows = this.rows(table);
    return (
      filter ? rows.filter((r) => r[filter.column] === filter.value) : rows
    ) as T[];
  }

  async upsert(
    table: string,
    data: Record<string, unknown>,
    conflictColumn: string
  ): Promise<void> {
    const rows = this.rows(table);
    const idx = rows.findIndex(
      (r) => r[conflictColumn] === data[conflictColumn]
    );
    if (idx >= 0) rows[idx] = { ...rows[idx], ...data };
    else rows.push({ ...data });
  }

  async update(
    table: string,
    data: Record<string, unknown>,
    filter: { column: string; value: unknown }
  ): Promise<void> {
    const row = this.rows(table).find((r) => r[filter.column] === filter.value);
    if (row) Object.assign(row, data);
  }

  asPostgresClient(): PostgresClient {
    return this as unknown as PostgresClient;
  }
}

// CacheRepository runs unmodified against this fake, which mirrors the real
// RedisClient's contract. The ttlSeconds argument on set is unused but matched
// for compatibility.
export class FakeRedis {
  private readonly store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) ?? null;
  }

  async set(key: string, value: unknown, _ttlSeconds?: number): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async deletePattern(pattern: string): Promise<void> {
    const prefix = pattern.replace(/\*$/, "");
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  size(): number {
    return this.store.size;
  }

  asRedisClient(): RedisClient {
    return this as unknown as RedisClient;
  }
}

export function makeMessage(
  overrides: Partial<Message> &
    Pick<Message, "senderId" | "chatId" | "isGroup" | "body">
): Message {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    senderName: "Tester",
    timestamp: new Date(),
    hasMedia: false,
    mentionedUserIds: [],
    ...overrides,
  };
}
