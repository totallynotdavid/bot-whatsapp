import { beforeEach, describe, expect, test } from "vitest";
import { KickCommand } from "../src/application/commands/kick-command";
import { Rank } from "../src/domain/user";
import { MESSAGES, formatPermissionDenied } from "../src/i18n/es";
import { OWNER_PHONE, REGULAR_PHONE, dm, inGroup, makeBot } from "./fixtures";

const PREMIUM_PHONE = "51911111111";
const VICTIM = "51944444444";
const BYSTANDER = "51955555555";
const GROUP_ID = "120363000000000001@g.us";

function setup() {
  const bot = makeBot(({ sender }) => [
    new KickCommand(sender.asWhatsAppSender()),
  ]);
  bot.sender.groupMembers.set(
    GROUP_ID,
    new Set([OWNER_PHONE, REGULAR_PHONE, PREMIUM_PHONE, VICTIM, BYSTANDER])
  );
  return bot;
}

describe("/kick command", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(async () => {
    ctx = setup();
    await ctx.userService.grantPremium(PREMIUM_PHONE, 30);
  });

  const members = () => ctx.sender.groupMembers.get(GROUP_ID)!;

  test("a regular user is rejected and nobody is removed", async () => {
    const result = await ctx.executor.execute(
      inGroup(REGULAR_PHONE, GROUP_ID, "/kick", {
        mentionedUserIds: [VICTIM],
      })
    );

    expect(result).toEqual({
      type: "error",
      userMessage: formatPermissionDenied(Rank.ADMIN),
    });
    expect(members().has(VICTIM)).toBe(true);
  });

  test("a premium user is still below the required rank", async () => {
    const result = await ctx.executor.execute(
      inGroup(PREMIUM_PHONE, GROUP_ID, "/kick", {
        mentionedUserIds: [VICTIM],
      })
    );

    expect(result).toEqual({
      type: "error",
      userMessage: formatPermissionDenied(Rank.ADMIN),
    });
    expect(members().has(VICTIM)).toBe(true);
  });

  test("the owner removes a mentioned member", async () => {
    const result = await ctx.executor.execute(
      inGroup(OWNER_PHONE, GROUP_ID, "/kick @victim", {
        mentionedUserIds: [VICTIM],
      })
    );

    expect(result).toEqual({
      type: "text",
      content: MESSAGES.success.userKicked,
    });
    expect(members().has(VICTIM)).toBe(false);
    expect(members().has(BYSTANDER)).toBe(true);
  });

  test("the owner removes the author of a quoted message, and the alias /ban works", async () => {
    const result = await ctx.executor.execute(
      inGroup(OWNER_PHONE, GROUP_ID, "/ban", {
        quotedMessageId: "quoted-1",
        quotedUserId: VICTIM,
      })
    );

    expect(result).toEqual({
      type: "text",
      content: MESSAGES.success.userKicked,
    });
    expect(members().has(VICTIM)).toBe(false);
  });

  test("a target who is not in the group is reported as a failure", async () => {
    const outsider = "51966666666";

    const result = await ctx.executor.execute(
      inGroup(OWNER_PHONE, GROUP_ID, "/kick", {
        mentionedUserIds: [outsider],
      })
    );

    expect(result?.type).toBe("error");
    expect(members().size).toBe(5);
  });

  test("without a mention or quoted message it asks for a target and removes nobody", async () => {
    const result = await ctx.executor.execute(
      inGroup(OWNER_PHONE, GROUP_ID, "/kick")
    );

    expect(result?.type).toBe("error");
    expect(members().size).toBe(5);
  });

  test("kicking yourself is refused and you stay in the group", async () => {
    const result = await ctx.executor.execute(
      inGroup(OWNER_PHONE, GROUP_ID, "/kick", {
        mentionedUserIds: [OWNER_PHONE],
      })
    );

    expect(result).not.toEqual({
      type: "text",
      content: MESSAGES.success.userKicked,
    });
    expect(members().has(OWNER_PHONE)).toBe(true);
  });

  test("outside a group it is rejected", async () => {
    const result = await ctx.executor.execute(
      dm(OWNER_PHONE, "/kick", { mentionedUserIds: [VICTIM] })
    );

    expect(result).toEqual({
      type: "error",
      userMessage: MESSAGES.errors.groupOnly,
    });
    expect(members().has(VICTIM)).toBe(true);
  });
});
