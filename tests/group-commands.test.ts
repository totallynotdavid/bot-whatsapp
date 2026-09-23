import { beforeEach, describe, expect, test } from "vitest";
import { AddGroupCommand } from "../src/application/commands/addgroup-command";
import { BotCommand } from "../src/application/commands/bot-command";
import { SubscriptionCommand } from "../src/application/commands/subscription-command";
import { HelpCommand } from "../src/application/commands/help-command";
import { MESSAGES } from "../src/i18n/es";
import { REGULAR_PHONE, dm, inGroup, makeBot } from "./fixtures";

const PREMIUM_PHONE = "51911111111";
const NEW_OWNER_PHONE = "51933333333";
const GROUP_ID = "120363000000000001@g.us";
const UNREGISTERED_GROUP_ID = "120363000000000002@g.us";

function setup() {
  return makeBot(({ groupRepo, executor }) => [
    new AddGroupCommand(groupRepo),
    new BotCommand(groupRepo),
    new SubscriptionCommand(groupRepo),
    new HelpCommand(executor),
  ]);
}

describe("group registration and toggling (CommandExecutor + group commands)", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(async () => {
    ctx = setup();
    await ctx.userService.grantPremium(PREMIUM_PHONE, 30);
    await ctx.userService.grantPremium(NEW_OWNER_PHONE, 30);
  });

  test("premium user registers a fresh group with /addgroup", async () => {
    const result = await ctx.executor.execute(
      inGroup(PREMIUM_PHONE, GROUP_ID, "/addgroup", {
        groupName: "Amigos del bot",
      })
    );

    expect(result).toEqual({
      type: "text",
      content: MESSAGES.success.groupRegistered,
    });
  });

  test("registering the same group twice under the same owner is rejected", async () => {
    const message = inGroup(PREMIUM_PHONE, GROUP_ID, "/addgroup", {
      groupName: "Amigos del bot",
    });

    await ctx.executor.execute(message);
    const result = await ctx.executor.execute(message);

    expect(result).toEqual({
      type: "error",
      userMessage: MESSAGES.errors.groupAlreadyRegistered,
    });
  });

  test("/bot off then /bot off again then /bot on", async () => {
    await ctx.executor.execute(
      inGroup(PREMIUM_PHONE, GROUP_ID, "/addgroup", {
        groupName: "Amigos del bot",
      })
    );

    const off = await ctx.executor.execute(
      inGroup(PREMIUM_PHONE, GROUP_ID, "/bot off")
    );
    expect(off).toEqual({ type: "text", content: MESSAGES.success.botOff });

    const offAgain = await ctx.executor.execute(
      inGroup(PREMIUM_PHONE, GROUP_ID, "/bot off")
    );
    expect(offAgain).toEqual({
      type: "text",
      content: MESSAGES.info.botAlreadyOff,
    });

    const on = await ctx.executor.execute(
      inGroup(PREMIUM_PHONE, GROUP_ID, "/bot on")
    );
    expect(on).toEqual({ type: "text", content: MESSAGES.success.botOn });
  });

  test("/subscription reports status for premium and non-premium users in a DM", async () => {
    const premiumResult = await ctx.executor.execute(
      dm(PREMIUM_PHONE, "/subscription")
    );
    expect(premiumResult?.type).toBe("text");
    expect((premiumResult as { content: string }).content).toContain(
      MESSAGES.info.subscriptionHeader
    );

    const regularResult = await ctx.executor.execute(
      dm(REGULAR_PHONE, "/subscription")
    );
    expect(regularResult).toEqual({
      type: "text",
      content: MESSAGES.info.noSubscription,
    });
  });

  test("a different premium user can reactivate a lapsed group via /addgroup", async () => {
    await ctx.executor.execute(
      inGroup(PREMIUM_PHONE, GROUP_ID, "/addgroup", {
        groupName: "Amigos del bot",
      })
    );
    await ctx.groupRepo.setActive(GROUP_ID, false);

    const result = await ctx.executor.execute(
      inGroup(NEW_OWNER_PHONE, GROUP_ID, "/addgroup", {
        groupName: "Amigos del bot",
      })
    );

    expect(result).toEqual({
      type: "text",
      content: MESSAGES.success.groupRegistered,
    });

    const group = await ctx.groupRepo.findByGroupId(GROUP_ID);
    expect(group?.contactNumber).toBe(NEW_OWNER_PHONE);
    expect(group?.isActive).toBe(true);
  });

  describe("CommandExecutor's active-group gate", () => {
    test("a REGULAR-rank, default-gated command is denied in an unregistered group", async () => {
      const result = await ctx.executor.execute(
        inGroup(REGULAR_PHONE, UNREGISTERED_GROUP_ID, "/help")
      );

      expect(result).toEqual({
        type: "error",
        userMessage: MESSAGES.errors.groupSubscriptionInactive,
      });
    });

    test("a command with requiresActiveGroup: false bypasses the gate for premium and non-premium users", async () => {
      const premiumInUnregistered = await ctx.executor.execute(
        inGroup(NEW_OWNER_PHONE, UNREGISTERED_GROUP_ID, "/subscription")
      );
      expect(premiumInUnregistered?.type).toBe("text");

      const regularInUnregistered = await ctx.executor.execute(
        inGroup(REGULAR_PHONE, UNREGISTERED_GROUP_ID, "/subscription")
      );
      expect(regularInUnregistered).toEqual({
        type: "text",
        content: MESSAGES.info.noSubscription,
      });
    });

    test("the gate never applies to DMs", async () => {
      const result = await ctx.executor.execute(
        dm(REGULAR_PHONE, "/subscription")
      );
      expect(result).toEqual({
        type: "text",
        content: MESSAGES.info.noSubscription,
      });
    });

    test("a PREMIUM-rank command (requiresActiveGroup defaults false) is not blocked by the gate, and registering the group opens the gate for REGULAR-rank commands", async () => {
      const addResult = await ctx.executor.execute(
        inGroup(NEW_OWNER_PHONE, UNREGISTERED_GROUP_ID, "/addgroup", {
          groupName: "Grupo nuevo",
        })
      );
      expect(addResult).toEqual({
        type: "text",
        content: MESSAGES.success.groupRegistered,
      });

      const helpResult = await ctx.executor.execute(
        inGroup(REGULAR_PHONE, UNREGISTERED_GROUP_ID, "/help")
      );
      expect(helpResult?.type).toBe("text");
      const listedCommands = (helpResult as { content: string }).content
        .split("\n")
        .filter((line) => line.startsWith("/"));
      expect(listedCommands).toContain("/help");
      expect(listedCommands).toContain("/subscription");
      expect(listedCommands).not.toContain("/addgroup");
      expect(listedCommands).not.toContain("/bot");
    });
  });
});
