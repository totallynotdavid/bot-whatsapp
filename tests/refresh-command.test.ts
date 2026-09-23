// Exercises RefreshCommand: an owner clearing UserService's in-process user
// cache, a non-owner being denied, and the cache actually being empty
// afterwards.

import { describe, expect, test } from "vitest";
import { UserRepository } from "../src/infrastructure/database/repositories/user-repository";
import { GroupRepository } from "../src/infrastructure/database/repositories/group-repository";
import { PermissionChecker } from "../src/application/services/permission-checker";
import { UserService } from "../src/application/services/user-service";
import { CommandExecutor } from "../src/application/services/command-executor";
import { RefreshCommand } from "../src/application/commands/refresh-command";
import { MESSAGES } from "../src/i18n/es";
import { Rank } from "../src/domain/user";
import { formatPermissionDenied } from "../src/i18n/es";
import { FakePostgres, makeMessage } from "./fixtures";

const OWNER_PHONE = "51900000000";
const REGULAR_PHONE = "51922222222";

function setup() {
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

  executor.registerCommand(new RefreshCommand(userService));

  return { executor, userService, postgres };
}

describe("/refresh command", () => {
  test("a non-owner is denied", async () => {
    const { executor } = setup();

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
  });

  test("the owner clears the cache", async () => {
    const { executor } = setup();

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
  });

  test("the owner clearing the cache also drops UserService's stale in-process entries", async () => {
    const { executor, userService, postgres } = setup();

    // Cache the regular user's record before they have any Postgres row,
    // as a real lookup would during normal command handling.
    const before = await userService.getUser(REGULAR_PHONE);
    expect(before.rank).toBe(Rank.REGULAR);

    // The user upgrades to premium. Nothing in the running process observes
    // this until the in-process cache entry above expires or is cleared.
    await postgres.upsert(
      "paid_users",
      {
        phone_number: REGULAR_PHONE,
        premium_expiry: new Date(Date.now() + 86_400_000).toISOString(),
        customer_name: "Regular",
      },
      "phone_number"
    );

    await executor.execute(
      makeMessage({
        senderId: OWNER_PHONE,
        chatId: `${OWNER_PHONE}@c.us`,
        isGroup: false,
        body: "/refresh",
      })
    );

    const after = await userService.getUser(REGULAR_PHONE);
    expect(after.rank).toBe(Rank.PREMIUM);
  });
});
