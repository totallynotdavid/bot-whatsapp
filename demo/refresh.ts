// Traces /refresh: an owner flushing the permission cache, a non-owner
// being denied, and the cache actually being empty afterwards.
// Run with: bun run demo/refresh.ts

process.env["OWNER_PHONE"] ??= "51900000000";
process.env["SUPABASE_URL"] ??= "https://example.supabase.co";
process.env["SUPABASE_KEY"] ??= "x".repeat(32);

import { loadConfig } from "../src/config";
import type { PostgresClient } from "../src/infrastructure/database/postgres";
import { UserRepository } from "../src/infrastructure/database/repositories/user-repository";
import { GroupRepository } from "../src/infrastructure/database/repositories/group-repository";
import { CacheRepository } from "../src/infrastructure/database/repositories/cache-repository";
import type { RedisClient } from "../src/infrastructure/database/redis";
import { PermissionChecker } from "../src/application/services/permission-checker";
import { UserService } from "../src/application/services/user-service";
import { CommandExecutor } from "../src/application/services/command-executor";
import { RefreshCommand } from "../src/application/commands/refresh-command";
import type { Message } from "../src/domain/message";
import type { CommandResult } from "../src/domain/command";

class FakeRedis {
  private readonly store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) ?? null;
  }

  async set(key: string, value: unknown): Promise<void> {
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
}

class FakePostgres {
  async queryOne<T>(): Promise<T | null> {
    return null;
  }
  async queryMany<T>(): Promise<T[]> {
    return [];
  }
  async upsert(): Promise<void> {}
  async update(): Promise<void> {}
}

const OWNER_PHONE = "51900000000";
const REGULAR_PHONE = "51922222222";

function makeMessage(
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

function report(label: string, result: CommandResult | null): void {
  const summary =
    result === null
      ? "(no command matched)"
      : result.type === "text"
        ? result.content
        : result.type === "error"
          ? `[error] ${result.userMessage}`
          : `[${result.type}]`;
  console.log(`${label}\n  -> ${summary.replace(/\n/g, "\n     ")}\n`);
}

async function main(): Promise<void> {
  loadConfig();

  const postgres = new FakePostgres() as unknown as PostgresClient;
  const redis = new FakeRedis() as unknown as RedisClient;

  const userRepo = new UserRepository(postgres);
  const groupRepo = new GroupRepository(postgres);
  const cacheRepo = new CacheRepository(redis);
  const permissionChecker = new PermissionChecker(cacheRepo, OWNER_PHONE);
  const userService = new UserService(userRepo, permissionChecker, OWNER_PHONE);
  const executor = new CommandExecutor(
    userService,
    permissionChecker,
    groupRepo,
    "/"
  );

  executor.registerCommand(new RefreshCommand(cacheRepo));

  console.log("=== Scenario 1: non-owner is denied ===");
  // Prime a permission cache entry for the regular user, as a real
  // permission check would during normal command handling.
  await cacheRepo.setPermission(`${REGULAR_PHONE}:${20}`, {
    allowed: false,
    denialReason: "denied",
  });
  console.log(
    `(seeded ${(redis as unknown as FakeRedis).size()} permission cache entr${
      (redis as unknown as FakeRedis).size() === 1 ? "y" : "ies"
    })\n`
  );
  report(
    "non-owner runs /refresh",
    await executor.execute(
      makeMessage({
        senderId: REGULAR_PHONE,
        chatId: `${REGULAR_PHONE}@c.us`,
        isGroup: false,
        body: "/refresh",
      })
    )
  );
  console.log(
    `(cache still has ${(redis as unknown as FakeRedis).size()} entries — refresh never ran)\n`
  );

  console.log("=== Scenario 2: owner clears the permission cache ===");
  report(
    "owner runs /refresh",
    await executor.execute(
      makeMessage({
        senderId: OWNER_PHONE,
        chatId: `${OWNER_PHONE}@c.us`,
        isGroup: false,
        body: "/refresh",
      })
    )
  );
  const remaining = (redis as unknown as FakeRedis).size();
  console.log(
    remaining === 0
      ? "(cache is empty — flush confirmed)\n"
      : `(unexpected: ${remaining} entries remain)\n`
  );
}

main().catch((error) => {
  console.error("Demo failed:", error);
  process.exit(1);
});
