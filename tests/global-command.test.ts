import { describe, expect, test, vi } from "vitest";
import { GlobalCommand } from "../src/application/commands/global-command";
import {
  formatPermissionDenied,
  formatGlobalBroadcastResult,
} from "../src/i18n/es";
import { Rank } from "../src/domain/user";
import { GLOBAL_BROADCAST_DELAY_MS } from "../src/config/constants";
import {
  OWNER_PHONE,
  REGULAR_PHONE,
  dm,
  makeBot,
  type BotDeps,
} from "./fixtures";

const ACTIVE_1 = "51911111111";
const ACTIVE_2 = "51933333333";
const LAPSED = "51944444444";

function setup() {
  return makeBot(({ userRepo, sender }) => [
    new GlobalCommand({ users: userRepo, sender }),
  ]);
}

async function addPremium(
  postgres: BotDeps["postgres"],
  phoneNumber: string,
  expiresInMs: number
): Promise<void> {
  await postgres.upsert(
    "paid_users",
    {
      phone_number: phoneNumber,
      premium_expiry: new Date(Date.now() + expiresInMs).toISOString(),
      customer_name: "Tester",
    },
    "phone_number"
  );
}

const addActivePremium = (postgres: BotDeps["postgres"], phone: string) =>
  addPremium(postgres, phone, 86_400_000);

describe("/global command", () => {
  test("a non-owner is rejected before any send happens", async () => {
    const { executor, postgres, sender } = setup();
    await addActivePremium(postgres, ACTIVE_1);

    const result = await executor.execute(
      dm(REGULAR_PHONE, "/global hola a todos")
    );

    expect(result).toEqual({
      type: "error",
      userMessage: formatPermissionDenied(Rank.OWNER),
    });
    expect(sender.sentTo).toEqual([]);
  });

  test("the owner broadcasts only to currently active premium users, skipping a lapsed one", async () => {
    const { executor, postgres, sender } = setup();
    await addActivePremium(postgres, ACTIVE_1);
    await addActivePremium(postgres, ACTIVE_2);
    await addPremium(postgres, LAPSED, -86_400_000);

    vi.useFakeTimers();
    try {
      const resultPromise = executor.execute(
        dm(OWNER_PHONE, "/global hola a todos")
      );

      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(sender.sentTo.sort()).toEqual(
        [`${ACTIVE_1}@c.us`, `${ACTIVE_2}@c.us`].sort()
      );
      expect(result).toEqual({
        type: "text",
        content: formatGlobalBroadcastResult(2, 0),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("a send failure for one recipient is counted without aborting the rest of the broadcast", async () => {
    const { executor, postgres, sender } = setup();
    await addActivePremium(postgres, ACTIVE_1);
    await addActivePremium(postgres, ACTIVE_2);
    sender.failNext(`${ACTIVE_1}@c.us`);

    vi.useFakeTimers();
    try {
      const resultPromise = executor.execute(dm(OWNER_PHONE, "/global hola"));

      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(sender.sentTo).toEqual([`${ACTIVE_2}@c.us`]);
      expect(result).toEqual({
        type: "text",
        content: formatGlobalBroadcastResult(1, 1),
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("the broadcast delay actually elapses between sends", async () => {
    const { executor, postgres, sender } = setup();
    await addActivePremium(postgres, ACTIVE_1);
    await addActivePremium(postgres, ACTIVE_2);

    vi.useFakeTimers();
    try {
      const resultPromise = executor.execute(dm(OWNER_PHONE, "/global hola"));

      // Let the first send resolve and the pacing delay get scheduled.
      await vi.advanceTimersByTimeAsync(0);
      expect(sender.sentTo).toEqual([`${ACTIVE_1}@c.us`]);

      // Just under the gap: the second send must not have happened yet.
      await vi.advanceTimersByTimeAsync(GLOBAL_BROADCAST_DELAY_MS - 1);
      expect(sender.sentTo).toEqual([`${ACTIVE_1}@c.us`]);

      // Crossing the gap lets the second send proceed.
      await vi.advanceTimersByTimeAsync(1);
      expect(sender.sentTo).toEqual([`${ACTIVE_1}@c.us`, `${ACTIVE_2}@c.us`]);

      const result = await resultPromise;
      expect(result).toEqual({
        type: "text",
        content: formatGlobalBroadcastResult(2, 0),
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
