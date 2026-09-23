import { describe, expect, test, vi } from "vitest";
import { UserRepository } from "../src/infrastructure/database/repositories/user-repository";
import { GroupRepository } from "../src/infrastructure/database/repositories/group-repository";
import { CacheRepository } from "../src/infrastructure/database/repositories/cache-repository";
import { PermissionChecker } from "../src/application/services/permission-checker";
import { UserService } from "../src/application/services/user-service";
import { CommandExecutor } from "../src/application/services/command-executor";
import { GlobalCommand } from "../src/application/commands/global-command";
import {
  formatPermissionDenied,
  formatGlobalBroadcastResult,
} from "../src/i18n/es";
import { Rank } from "../src/domain/user";
import type { WhatsAppSender } from "../src/infrastructure/whatsapp/sender";
import { FakePostgres, FakeRedis, makeMessage } from "./fixtures";

const OWNER_PHONE = "51900000000";
const REGULAR_PHONE = "51922222222";
const ACTIVE_1 = "51911111111";
const ACTIVE_2 = "51933333333";
const LAPSED = "51944444444";

class FakeSender {
  readonly sentTo: string[] = [];
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

  asWhatsAppSender(): WhatsAppSender {
    return this as unknown as WhatsAppSender;
  }
}

function setup() {
  const postgres = new FakePostgres().asPostgresClient();
  const redis = new FakeRedis().asRedisClient();

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
  const sender = new FakeSender();

  executor.registerCommand(
    new GlobalCommand(userRepo, sender.asWhatsAppSender())
  );

  return { executor, postgres, userService, sender };
}

async function addActivePremium(
  postgres: ReturnType<typeof FakePostgres.prototype.asPostgresClient>,
  phoneNumber: string
): Promise<void> {
  await postgres.upsert(
    "paid_users",
    {
      phone_number: phoneNumber,
      premium_expiry: new Date(Date.now() + 86_400_000).toISOString(),
      customer_name: "Tester",
    },
    "phone_number"
  );
}

describe("/global command", () => {
  test("a non-owner is rejected before any send happens", async () => {
    const { executor, postgres, sender } = setup();
    await addActivePremium(postgres, ACTIVE_1);

    const result = await executor.execute(
      makeMessage({
        senderId: REGULAR_PHONE,
        chatId: `${REGULAR_PHONE}@c.us`,
        isGroup: false,
        body: "/global hola a todos",
      })
    );

    expect(result).toEqual({
      type: "error",
      userMessage: formatPermissionDenied(Rank.OWNER),
    });
    expect(sender.sentTo).toEqual([]);
  });

  test("the owner broadcasts only to currently active premium users, skipping a lapsed one", async () => {
    const { executor, postgres, userService, sender } = setup();
    await addActivePremium(postgres, ACTIVE_1);
    await addActivePremium(postgres, ACTIVE_2);
    await postgres.upsert(
      "paid_users",
      {
        phone_number: LAPSED,
        premium_expiry: new Date(Date.now() - 86_400_000).toISOString(),
        customer_name: "Lapsed",
      },
      "phone_number"
    );
    userService.clearCache();

    vi.useFakeTimers();
    try {
      const resultPromise = executor.execute(
        makeMessage({
          senderId: OWNER_PHONE,
          chatId: `${OWNER_PHONE}@c.us`,
          isGroup: false,
          body: "/global hola a todos",
        })
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
      const resultPromise = executor.execute(
        makeMessage({
          senderId: OWNER_PHONE,
          chatId: `${OWNER_PHONE}@c.us`,
          isGroup: false,
          body: "/global hola",
        })
      );

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

  test("a 5-second gap actually elapses between sends", async () => {
    const { executor, postgres, sender } = setup();
    await addActivePremium(postgres, ACTIVE_1);
    await addActivePremium(postgres, ACTIVE_2);

    vi.useFakeTimers();
    try {
      const resultPromise = executor.execute(
        makeMessage({
          senderId: OWNER_PHONE,
          chatId: `${OWNER_PHONE}@c.us`,
          isGroup: false,
          body: "/global hola",
        })
      );

      // Let the first send resolve and the pacing delay get scheduled.
      await vi.advanceTimersByTimeAsync(0);
      expect(sender.sentTo).toEqual([`${ACTIVE_1}@c.us`]);

      // Just under the 5s gap: the second send must not have happened yet.
      await vi.advanceTimersByTimeAsync(4999);
      expect(sender.sentTo).toEqual([`${ACTIVE_1}@c.us`]);

      // Crossing the 5s mark lets the second send proceed.
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
