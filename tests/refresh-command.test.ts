// Exercises RefreshCommand: an owner flushing the permission cache, a
// non-owner being denied, and the cache actually being empty afterwards.

import { describe, expect, test } from "vitest";
import { UserRepository } from "../src/infrastructure/database/repositories/user-repository";
import { GroupRepository } from "../src/infrastructure/database/repositories/group-repository";
import { CacheRepository } from "../src/infrastructure/database/repositories/cache-repository";
import { PermissionChecker } from "../src/application/services/permission-checker";
import { UserService } from "../src/application/services/user-service";
import { CommandExecutor } from "../src/application/services/command-executor";
import { RefreshCommand } from "../src/application/commands/refresh-command";
import { MESSAGES } from "../src/i18n/es";
import { Rank } from "../src/domain/user";
import { formatPermissionDenied } from "../src/i18n/es";
import { FakePostgres, FakeRedis, makeMessage } from "./fixtures";

const OWNER_PHONE = "51900000000";
const REGULAR_PHONE = "51922222222";

function setup() {
  const postgres = new FakePostgres().asPostgresClient();
  const redis = new FakeRedis();

  const userRepo = new UserRepository(postgres);
  const groupRepo = new GroupRepository(postgres);
  const cacheRepo = new CacheRepository(redis.asRedisClient());
  const permissionChecker = new PermissionChecker(cacheRepo, OWNER_PHONE);
  const userService = new UserService(userRepo, permissionChecker, OWNER_PHONE);
  const executor = new CommandExecutor(
    userService,
    permissionChecker,
    groupRepo,
    "/"
  );

  executor.registerCommand(new RefreshCommand(cacheRepo));

  return { executor, cacheRepo, redis };
}

describe("/refresh command", () => {
  test("a non-owner is denied and the permission cache is left untouched by the command itself", async () => {
    const { executor, cacheRepo, redis } = setup();

    // Prime a permission cache entry for the regular user, as a real
    // permission check would during normal command handling.
    await cacheRepo.setPermission(`${REGULAR_PHONE}:${Rank.PREMIUM}`, {
      allowed: false,
      denialReason: "denied",
    });
    expect(redis.size()).toBe(1);

    const result = await executor.execute(
      makeMessage({
        senderId: REGULAR_PHONE,
        chatId: `${REGULAR_PHONE}@c.us`,
        isGroup: false,
        body: "/refresh",
      })
    );

    expect(result).toEqual({
      type: "error",
      userMessage: formatPermissionDenied(Rank.OWNER),
    });
    // The seeded entry, plus the checker's own cached denial for this
    // command's rank requirement — refresh never ran, so nothing was
    // flushed.
    expect(redis.size()).toBe(2);
  });

  test("the owner clears the permission cache", async () => {
    const { executor, cacheRepo, redis } = setup();

    await cacheRepo.setPermission(`${REGULAR_PHONE}:${Rank.PREMIUM}`, {
      allowed: false,
      denialReason: "denied",
    });
    expect(redis.size()).toBe(1);

    const result = await executor.execute(
      makeMessage({
        senderId: OWNER_PHONE,
        chatId: `${OWNER_PHONE}@c.us`,
        isGroup: false,
        body: "/refresh",
      })
    );

    expect(result).toEqual({
      type: "text",
      content: MESSAGES.success.cacheRefreshed,
    });
    expect(redis.size()).toBe(0);
  });
});
