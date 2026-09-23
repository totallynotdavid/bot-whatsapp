// Traces addgroup/bot/subscription and the CommandExecutor group gate
// against an in-memory fake standing in for Supabase Postgres.
// Run with: bun run demo/group-commands.ts

import type { PostgresClient } from "../src/infrastructure/database/postgres";
import { UserRepository } from "../src/infrastructure/database/repositories/user-repository";
import { GroupRepository } from "../src/infrastructure/database/repositories/group-repository";
import type { CacheRepository } from "../src/infrastructure/database/repositories/cache-repository";
import { PermissionChecker } from "../src/application/services/permission-checker";
import { UserService } from "../src/application/services/user-service";
import { CommandExecutor } from "../src/application/services/command-executor";
import { AddGroupCommand } from "../src/application/commands/addgroup-command";
import { BotCommand } from "../src/application/commands/bot-command";
import { SubscriptionCommand } from "../src/application/commands/subscription-command";
import { HelpCommand } from "../src/application/commands/help-command";
import type { Message } from "../src/domain/message";
import type { CommandResult } from "../src/domain/command";

class FakePostgres {
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
}

class FakeCache {
  private readonly store = new Map<string, unknown>();
  async getPermission(key: string) {
    return this.store.get(key) ?? null;
  }
  async setPermission(key: string, result: unknown) {
    this.store.set(key, result);
  }
  async invalidateUserPermissions(phone: string) {
    for (const key of this.store.keys()) {
      if (key.startsWith(`${phone}:`)) this.store.delete(key);
    }
  }
}

const OWNER_PHONE = "51900000000";
const PREMIUM_PHONE = "51911111111";
const NEW_OWNER_PHONE = "51933333333";
const REGULAR_PHONE = "51922222222";
const GROUP_ID = "120363000000000001@g.us";
const UNREGISTERED_GROUP_ID = "120363000000000002@g.us";

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
  const postgres = new FakePostgres() as unknown as PostgresClient;
  const userRepo = new UserRepository(postgres);
  const groupRepo = new GroupRepository(postgres);
  const permissionChecker = new PermissionChecker(
    new FakeCache() as unknown as CacheRepository,
    OWNER_PHONE
  );
  const userService = new UserService(userRepo, permissionChecker, OWNER_PHONE);
  const executor = new CommandExecutor(
    userService,
    permissionChecker,
    groupRepo,
    "/"
  );

  executor.registerCommand(new AddGroupCommand(groupRepo));
  executor.registerCommand(new BotCommand(groupRepo));
  executor.registerCommand(new SubscriptionCommand(groupRepo));
  executor.registerCommand(new HelpCommand(executor));

  await userService.grantPremium(PREMIUM_PHONE, 30);
  await userService.grantPremium(NEW_OWNER_PHONE, 30);

  console.log("=== Scenario 1: addgroup registers a fresh group ===");
  report(
    "premium user runs /addgroup in a fresh group",
    await executor.execute(
      makeMessage({
        senderId: PREMIUM_PHONE,
        chatId: GROUP_ID,
        isGroup: true,
        groupName: "Amigos del bot",
        body: "/addgroup",
      })
    )
  );
  report(
    "same group, same owner, runs /addgroup again",
    await executor.execute(
      makeMessage({
        senderId: PREMIUM_PHONE,
        chatId: GROUP_ID,
        isGroup: true,
        groupName: "Amigos del bot",
        body: "/addgroup",
      })
    )
  );

  console.log("=== Scenario 2: bot toggles off then on ===");
  report(
    "/bot off",
    await executor.execute(
      makeMessage({
        senderId: PREMIUM_PHONE,
        chatId: GROUP_ID,
        isGroup: true,
        body: "/bot off",
      })
    )
  );
  report(
    "/bot off again (already off)",
    await executor.execute(
      makeMessage({
        senderId: PREMIUM_PHONE,
        chatId: GROUP_ID,
        isGroup: true,
        body: "/bot off",
      })
    )
  );
  report(
    "/bot on",
    await executor.execute(
      makeMessage({
        senderId: PREMIUM_PHONE,
        chatId: GROUP_ID,
        isGroup: true,
        body: "/bot on",
      })
    )
  );

  console.log("=== Scenario 3: subscription status ===");
  report(
    "premium user runs /subscription (DM)",
    await executor.execute(
      makeMessage({
        senderId: PREMIUM_PHONE,
        chatId: `${PREMIUM_PHONE}@c.us`,
        isGroup: false,
        body: "/subscription",
      })
    )
  );
  report(
    "non-premium user runs /subscription (DM)",
    await executor.execute(
      makeMessage({
        senderId: REGULAR_PHONE,
        chatId: `${REGULAR_PHONE}@c.us`,
        isGroup: false,
        body: "/subscription",
      })
    )
  );

  console.log("=== Scenario 4: reactivation by a new owner ===");
  await groupRepo.setActive(GROUP_ID, false);
  console.log(
    "(group deactivated directly, simulating a lapsed registration)\n"
  );
  report(
    "a different premium user runs /addgroup on the lapsed group",
    await executor.execute(
      makeMessage({
        senderId: NEW_OWNER_PHONE,
        chatId: GROUP_ID,
        isGroup: true,
        groupName: "Amigos del bot",
        body: "/addgroup",
      })
    )
  );

  console.log("=== Scenario 5: CommandExecutor group gate ===");
  report(
    "REGULAR-rank /help (default-gated) in an unregistered group is denied",
    await executor.execute(
      makeMessage({
        senderId: REGULAR_PHONE,
        chatId: UNREGISTERED_GROUP_ID,
        isGroup: true,
        body: "/help",
      })
    )
  );
  report(
    "REGULAR-rank /subscription (requiresActiveGroup: false) works for a premium user in that same unregistered group",
    await executor.execute(
      makeMessage({
        senderId: NEW_OWNER_PHONE,
        chatId: UNREGISTERED_GROUP_ID,
        isGroup: true,
        body: "/subscription",
      })
    )
  );
  report(
    "REGULAR-rank /subscription (requiresActiveGroup: false) works for a non-premium user in that same unregistered group",
    await executor.execute(
      makeMessage({
        senderId: REGULAR_PHONE,
        chatId: UNREGISTERED_GROUP_ID,
        isGroup: true,
        body: "/subscription",
      })
    )
  );
  report(
    "REGULAR-rank /subscription in a DM is unaffected by the gate",
    await executor.execute(
      makeMessage({
        senderId: REGULAR_PHONE,
        chatId: `${REGULAR_PHONE}@c.us`,
        isGroup: false,
        body: "/subscription",
      })
    )
  );
  report(
    "PREMIUM-rank /addgroup in that same unregistered group is not blocked by the gate",
    await executor.execute(
      makeMessage({
        senderId: NEW_OWNER_PHONE,
        chatId: UNREGISTERED_GROUP_ID,
        isGroup: true,
        groupName: "Grupo nuevo",
        body: "/addgroup",
      })
    )
  );
  report(
    "REGULAR-rank /help now works in that now-registered group",
    await executor.execute(
      makeMessage({
        senderId: REGULAR_PHONE,
        chatId: UNREGISTERED_GROUP_ID,
        isGroup: true,
        body: "/help",
      })
    )
  );
}

main().catch((error) => {
  console.error("Demo failed:", error);
  process.exit(1);
});
