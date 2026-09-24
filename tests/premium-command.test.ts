import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PremiumCommand } from "../src/application/commands/premium-command";
import { Rank } from "../src/domain/user";
import { formatPermissionDenied, formatPremiumGranted } from "../src/i18n/es";
import { OWNER_PHONE, REGULAR_PHONE, dm, inGroup, makeBot } from "./fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2024-01-15T12:00:00.000Z");
const PREMIUM_PHONE = "51911111111";
const TARGET = "51944444444";
const GROUP_ID = "120363000000000001@g.us";

function setup() {
  return makeBot(({ userService }) => [new PremiumCommand({ userService })]);
}

describe("/addpremium command", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    ctx = setup();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const stored = () => ctx.userRepo.findByPhoneNumber(TARGET);

  test("the owner grants premium for the given days to a quoted user", async () => {
    const result = await ctx.executor.execute(
      dm(OWNER_PHONE, "/addpremium 30", { quotedUserId: `${TARGET}@c.us` })
    );

    expect(result).toEqual({ type: "text", content: formatPremiumGranted(30) });
    const user = await stored();
    expect(user?.rank).toBe(Rank.PREMIUM);
    expect(user?.premiumExpiresAt?.getTime()).toBe(NOW.getTime() + 30 * DAY_MS);
    expect((await ctx.userService.getUser(TARGET)).rank).toBe(Rank.PREMIUM);
  });

  test("a mentioned user can be the target, and the aliases route to the command", async () => {
    const result = await ctx.executor.execute(
      inGroup(OWNER_PHONE, GROUP_ID, "/darpremium 7", {
        mentionedUserIds: [`${TARGET}@c.us`],
      })
    );

    expect(result).toEqual({ type: "text", content: formatPremiumGranted(7) });
    expect((await stored())?.premiumExpiresAt?.getTime()).toBe(
      NOW.getTime() + 7 * DAY_MS
    );
  });

  test.each([
    { name: "a regular user", sender: REGULAR_PHONE },
    { name: "a premium user", sender: PREMIUM_PHONE },
  ])("$name is rejected and nobody is granted premium", async ({ sender }) => {
    await ctx.userService.grantPremium(PREMIUM_PHONE, 30);

    const result = await ctx.executor.execute(
      dm(sender, "/addpremium 30", { quotedUserId: `${TARGET}@c.us` })
    );

    expect(result).toEqual({
      type: "error",
      userMessage: formatPermissionDenied(Rank.OWNER),
    });
    expect(await stored()).toBeNull();
  });

  test("without a quoted or mentioned user it asks for one", async () => {
    const result = await ctx.executor.execute(
      dm(OWNER_PHONE, "/addpremium 30")
    );

    expect(result?.type).toBe("error");
    expect(await stored()).toBeNull();
  });

  test("without a days argument nothing is granted", async () => {
    const result = await ctx.executor.execute(
      dm(OWNER_PHONE, "/addpremium", { quotedUserId: `${TARGET}@c.us` })
    );

    expect(result?.type).toBe("error");
    expect(await stored()).toBeNull();
  });

  test.each(["abc", "0", "-5"])(
    "the days argument %j is rejected and nothing is granted",
    async (days) => {
      const result = await ctx.executor.execute(
        dm(OWNER_PHONE, `/addpremium ${days}`, {
          quotedUserId: `${TARGET}@c.us`,
        })
      );

      expect(result?.type).toBe("error");
      expect(await stored()).toBeNull();
    }
  );

  test("a target that is not a valid phone number is rejected and nothing is granted", async () => {
    const shortNumber = "123";

    const result = await ctx.executor.execute(
      dm(OWNER_PHONE, "/addpremium 30", { quotedUserId: `${shortNumber}@c.us` })
    );

    expect(result?.type).toBe("error");
    expect(await ctx.userRepo.findByPhoneNumber(shortNumber)).toBeNull();
  });
});
