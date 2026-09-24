import { describe, expect, test } from "vitest";
import { RefreshCommand } from "../src/application/commands/refresh-command";
import { MESSAGES, formatPermissionDenied } from "../src/i18n/es";
import { Rank } from "../src/domain/user";
import { OWNER_PHONE, REGULAR_PHONE, dm, makeBot } from "./fixtures";

function setup() {
  return makeBot(({ userService }) => [new RefreshCommand({ userService })]);
}

describe("/refresh command", () => {
  test("a non-owner is denied", async () => {
    const { executor } = setup();

    const result = await executor.execute(dm(REGULAR_PHONE, "/refresh"));

    expect(result).toEqual({
      type: "error",
      userMessage: formatPermissionDenied(Rank.OWNER),
    });
  });

  test("the owner clears the cache", async () => {
    const { executor } = setup();

    const result = await executor.execute(dm(OWNER_PHONE, "/refresh"));

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

    await executor.execute(dm(OWNER_PHONE, "/refresh"));

    const after = await userService.getUser(REGULAR_PHONE);
    expect(after.rank).toBe(Rank.PREMIUM);
  });
});
