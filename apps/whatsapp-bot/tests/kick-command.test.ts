import { beforeEach, describe, expect, test } from "vitest";
import { KickCommand } from "../src/application/commands/kick-command";
import { MESSAGES } from "../src/i18n/es";
import { OWNER_PHONE, REGULAR_PHONE, dm, inGroup, makeBot } from "./fixtures";

const PREMIUM_PHONE = "51911111111";
const GROUP_ADMIN = "51977777777";
const VICTIM = "51944444444";
const BYSTANDER = "51955555555";
const GROUP_ID = "120363000000000001@g.us";

const NOT_ADMIN = {
  type: "error",
  userMessage: MESSAGES.errors.kickAdminOnly,
};
const KICKED = { type: "text", content: MESSAGES.success.userKicked };

function setup() {
  const bot = makeBot(({ sender }) => [new KickCommand({ sender })]);
  bot.sender.groupMembers.set(
    GROUP_ID,
    new Set([
      OWNER_PHONE,
      REGULAR_PHONE,
      PREMIUM_PHONE,
      GROUP_ADMIN,
      VICTIM,
      BYSTANDER,
    ])
  );
  bot.sender.groupAdmins.set(GROUP_ID, new Set([GROUP_ADMIN]));
  return bot;
}

describe("/kick command", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(async () => {
    ctx = setup();
    await ctx.userService.grantPremium(PREMIUM_PHONE, 30);
  });

  const members = () => ctx.sender.groupMembers.get(GROUP_ID)!;

  test("a regular member who is not a group admin is rejected and nobody is removed", async () => {
    const result = await ctx.executor.execute(
      inGroup(REGULAR_PHONE, GROUP_ID, "/kick", {
        mentionedUserIds: [VICTIM],
      })
    );

    expect(result).toEqual(NOT_ADMIN);
    expect(members().has(VICTIM)).toBe(true);
  });

  test("premium rank does not make a non-admin able to kick", async () => {
    const result = await ctx.executor.execute(
      inGroup(PREMIUM_PHONE, GROUP_ID, "/kick", {
        mentionedUserIds: [VICTIM],
      })
    );

    expect(result).toEqual(NOT_ADMIN);
    expect(members().has(VICTIM)).toBe(true);
  });

  test("a group admin removes a mentioned member", async () => {
    const result = await ctx.executor.execute(
      inGroup(GROUP_ADMIN, GROUP_ID, "/kick @victim", {
        mentionedUserIds: [VICTIM],
      })
    );

    expect(result).toEqual(KICKED);
    expect(members().has(VICTIM)).toBe(false);
    expect(members().has(BYSTANDER)).toBe(true);
  });

  test("admin status in one group gives no power in another", async () => {
    const otherGroup = "120363000000000002@g.us";
    ctx.sender.groupMembers.set(otherGroup, new Set([GROUP_ADMIN, VICTIM]));

    const result = await ctx.executor.execute(
      inGroup(GROUP_ADMIN, otherGroup, "/kick", {
        mentionedUserIds: [VICTIM],
      })
    );

    expect(result).toEqual(NOT_ADMIN);
    expect(ctx.sender.groupMembers.get(otherGroup)!.has(VICTIM)).toBe(true);
  });

  test("the owner removes a member without being a group admin", async () => {
    const result = await ctx.executor.execute(
      inGroup(OWNER_PHONE, GROUP_ID, "/kick @victim", {
        mentionedUserIds: [VICTIM],
      })
    );

    expect(result).toEqual(KICKED);
    expect(members().has(VICTIM)).toBe(false);
    expect(members().has(BYSTANDER)).toBe(true);
  });

  test("an admin removes the author of a quoted message, and the alias /ban works", async () => {
    const result = await ctx.executor.execute(
      inGroup(GROUP_ADMIN, GROUP_ID, "/ban", {
        quotedMessageId: "quoted-1",
        quotedUserId: VICTIM,
      })
    );

    expect(result).toEqual(KICKED);
    expect(members().has(VICTIM)).toBe(false);
  });

  test("a failed removal is reported to the user, not as an internal error", async () => {
    const outsider = "51966666666";
    const before = members().size;

    const result = await ctx.executor.execute(
      inGroup(GROUP_ADMIN, GROUP_ID, "/kick", {
        mentionedUserIds: [outsider],
      })
    );

    expect(result).toEqual({
      type: "error",
      userMessage:
        "No pude expulsar al usuario. Verifica que el bot sea administrador.",
    });
    expect(members().size).toBe(before);
  });

  test("without a mention or quoted message it asks for a target and removes nobody", async () => {
    const before = members().size;

    const result = await ctx.executor.execute(
      inGroup(GROUP_ADMIN, GROUP_ID, "/kick")
    );

    expect(result?.type).toBe("error");
    expect(members().size).toBe(before);
  });

  test("kicking yourself is refused and you stay in the group", async () => {
    const result = await ctx.executor.execute(
      inGroup(GROUP_ADMIN, GROUP_ID, "/kick", {
        mentionedUserIds: [GROUP_ADMIN],
      })
    );

    expect(result).not.toEqual(KICKED);
    expect(members().has(GROUP_ADMIN)).toBe(true);
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
