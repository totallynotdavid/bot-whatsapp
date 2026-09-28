import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Rank } from "../src/domain/user";
import { REGULAR_PHONE, makeBot } from "./fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2024-01-15T12:00:00.000Z");

describe("UserService.grantPremium", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("persists a PREMIUM user expiring exactly the given number of days from now", async () => {
    const { userService, userRepo } = makeBot();

    const granted = await userService.grantPremium(REGULAR_PHONE, 30, "Ana");

    const stored = await userRepo.findByPhoneNumber(REGULAR_PHONE);
    expect(stored).toEqual(granted);
    expect(stored?.rank).toBe(Rank.PREMIUM);
    expect(stored?.premiumExpiresAt?.getTime()).toBe(
      NOW.getTime() + 30 * DAY_MS
    );
  });

  test("the expiry scales with the days argument", async () => {
    const { userService } = makeBot();

    const user = await userService.grantPremium(REGULAR_PHONE, 7);

    expect(user.premiumExpiresAt?.getTime()).toBe(NOW.getTime() + 7 * DAY_MS);
  });

  test("uses the given name when provided", async () => {
    const { userService, userRepo } = makeBot();

    await userService.grantPremium(REGULAR_PHONE, 30, "Ana");

    expect((await userRepo.findByPhoneNumber(REGULAR_PHONE))?.name).toBe("Ana");
  });

  test('defaults the name to "Usuario Premium" when omitted', async () => {
    const { userService, userRepo } = makeBot();

    await userService.grantPremium(REGULAR_PHONE, 30);

    expect((await userRepo.findByPhoneNumber(REGULAR_PHONE))?.name).toBe(
      "Usuario Premium"
    );
  });

  test("granting to an already-premium user replaces the expiry and keeps them premium", async () => {
    const { userService, userRepo } = makeBot();
    await userService.grantPremium(REGULAR_PHONE, 5, "Ana");

    vi.setSystemTime(new Date(NOW.getTime() + 2 * DAY_MS));
    await userService.grantPremium(REGULAR_PHONE, 30, "Ana");

    const stored = await userRepo.findByPhoneNumber(REGULAR_PHONE);
    expect(stored?.rank).toBe(Rank.PREMIUM);
    expect(stored?.premiumExpiresAt?.getTime()).toBe(
      NOW.getTime() + 32 * DAY_MS
    );
  });

  test("getUser reflects the grant immediately, even after caching the pre-grant rank", async () => {
    const { userService } = makeBot();
    expect((await userService.getUser(REGULAR_PHONE)).rank).toBe(Rank.REGULAR);

    await userService.grantPremium(REGULAR_PHONE, 30, "Ana");

    expect((await userService.getUser(REGULAR_PHONE)).rank).toBe(Rank.PREMIUM);
  });
});
