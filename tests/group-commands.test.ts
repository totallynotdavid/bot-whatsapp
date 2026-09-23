// Exercises AddGroupCommand, BotCommand, SubscriptionCommand, HelpCommand,
// and CommandExecutor's active-group gate against in-memory fakes standing
// in for Supabase Postgres and Redis.

import { beforeEach, describe, expect, test } from "vitest";
import { UserRepository } from "../src/infrastructure/database/repositories/user-repository";
import { GroupRepository } from "../src/infrastructure/database/repositories/group-repository";
import { PermissionChecker } from "../src/application/services/permission-checker";
import { UserService } from "../src/application/services/user-service";
import { CommandExecutor } from "../src/application/services/command-executor";
import { AddGroupCommand } from "../src/application/commands/addgroup-command";
import { BotCommand } from "../src/application/commands/bot-command";
import { SubscriptionCommand } from "../src/application/commands/subscription-command";
import { HelpCommand } from "../src/application/commands/help-command";
import { MESSAGES } from "../src/i18n/es";
import { FakePostgres, makeMessage } from "./fixtures";

const OWNER_PHONE = "51900000000";
const PREMIUM_PHONE = "51911111111";
const NEW_OWNER_PHONE = "51933333333";
const REGULAR_PHONE = "51922222222";
const GROUP_ID = "120363000000000001@g.us";
const UNREGISTERED_GROUP_ID = "120363000000000002@g.us";

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

  executor.registerCommand(new AddGroupCommand(groupRepo));
  executor.registerCommand(new BotCommand(groupRepo));
  executor.registerCommand(new SubscriptionCommand(groupRepo));
  executor.registerCommand(new HelpCommand(executor));

  return { executor, userService, groupRepo };
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
      makeMessage({
        senderId: PREMIUM_PHONE,
        chatId: GROUP_ID,
        isGroup: true,
        groupName: "Amigos del bot",
        body: "/addgroup",
      })
    );

    expect(result).toEqual({
      type: "text",
      content: MESSAGES.success.groupRegistered,
    });
  });

  test("registering the same group twice under the same owner is rejected", async () => {
    const message = makeMessage({
      senderId: PREMIUM_PHONE,
      chatId: GROUP_ID,
      isGroup: true,
      groupName: "Amigos del bot",
      body: "/addgroup",
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
      makeMessage({
        senderId: PREMIUM_PHONE,
        chatId: GROUP_ID,
        isGroup: true,
        groupName: "Amigos del bot",
        body: "/addgroup",
      })
    );

    const off = await ctx.executor.execute(
      makeMessage({
        senderId: PREMIUM_PHONE,
        chatId: GROUP_ID,
        isGroup: true,
        body: "/bot off",
      })
    );
    expect(off).toEqual({ type: "text", content: MESSAGES.success.botOff });

    const offAgain = await ctx.executor.execute(
      makeMessage({
        senderId: PREMIUM_PHONE,
        chatId: GROUP_ID,
        isGroup: true,
        body: "/bot off",
      })
    );
    expect(offAgain).toEqual({
      type: "text",
      content: MESSAGES.info.botAlreadyOff,
    });

    const on = await ctx.executor.execute(
      makeMessage({
        senderId: PREMIUM_PHONE,
        chatId: GROUP_ID,
        isGroup: true,
        body: "/bot on",
      })
    );
    expect(on).toEqual({ type: "text", content: MESSAGES.success.botOn });
  });

  test("/subscription reports status for premium and non-premium users in a DM", async () => {
    const premiumResult = await ctx.executor.execute(
      makeMessage({
        senderId: PREMIUM_PHONE,
        chatId: `${PREMIUM_PHONE}@c.us`,
        isGroup: false,
        body: "/subscription",
      })
    );
    expect(premiumResult?.type).toBe("text");
    expect((premiumResult as { content: string }).content).toContain(
      MESSAGES.info.subscriptionHeader
    );

    const regularResult = await ctx.executor.execute(
      makeMessage({
        senderId: REGULAR_PHONE,
        chatId: `${REGULAR_PHONE}@c.us`,
        isGroup: false,
        body: "/subscription",
      })
    );
    expect(regularResult).toEqual({
      type: "text",
      content: MESSAGES.info.noSubscription,
    });
  });

  test("a different premium user can reactivate a lapsed group via /addgroup", async () => {
    await ctx.executor.execute(
      makeMessage({
        senderId: PREMIUM_PHONE,
        chatId: GROUP_ID,
        isGroup: true,
        groupName: "Amigos del bot",
        body: "/addgroup",
      })
    );
    await ctx.groupRepo.setActive(GROUP_ID, false);

    const result = await ctx.executor.execute(
      makeMessage({
        senderId: NEW_OWNER_PHONE,
        chatId: GROUP_ID,
        isGroup: true,
        groupName: "Amigos del bot",
        body: "/addgroup",
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
        makeMessage({
          senderId: REGULAR_PHONE,
          chatId: UNREGISTERED_GROUP_ID,
          isGroup: true,
          body: "/help",
        })
      );

      expect(result).toEqual({
        type: "error",
        userMessage: MESSAGES.errors.groupSubscriptionInactive,
      });
    });

    test("a command with requiresActiveGroup: false bypasses the gate for premium and non-premium users", async () => {
      const premiumInUnregistered = await ctx.executor.execute(
        makeMessage({
          senderId: NEW_OWNER_PHONE,
          chatId: UNREGISTERED_GROUP_ID,
          isGroup: true,
          body: "/subscription",
        })
      );
      expect(premiumInUnregistered?.type).toBe("text");

      const regularInUnregistered = await ctx.executor.execute(
        makeMessage({
          senderId: REGULAR_PHONE,
          chatId: UNREGISTERED_GROUP_ID,
          isGroup: true,
          body: "/subscription",
        })
      );
      expect(regularInUnregistered).toEqual({
        type: "text",
        content: MESSAGES.info.noSubscription,
      });
    });

    test("the gate never applies to DMs", async () => {
      const result = await ctx.executor.execute(
        makeMessage({
          senderId: REGULAR_PHONE,
          chatId: `${REGULAR_PHONE}@c.us`,
          isGroup: false,
          body: "/subscription",
        })
      );
      expect(result).toEqual({
        type: "text",
        content: MESSAGES.info.noSubscription,
      });
    });

    test("a PREMIUM-rank command (requiresActiveGroup defaults false) is not blocked by the gate, and registering the group opens the gate for REGULAR-rank commands", async () => {
      const addResult = await ctx.executor.execute(
        makeMessage({
          senderId: NEW_OWNER_PHONE,
          chatId: UNREGISTERED_GROUP_ID,
          isGroup: true,
          groupName: "Grupo nuevo",
          body: "/addgroup",
        })
      );
      expect(addResult).toEqual({
        type: "text",
        content: MESSAGES.success.groupRegistered,
      });

      const helpResult = await ctx.executor.execute(
        makeMessage({
          senderId: REGULAR_PHONE,
          chatId: UNREGISTERED_GROUP_ID,
          isGroup: true,
          body: "/help",
        })
      );
      expect(helpResult?.type).toBe("text");
      const content = (helpResult as { content: string }).content;
      expect(content).toContain("/help");
      expect(content).toContain("/subscription");
      expect(content).not.toContain("/addgroup");
      expect(content).not.toContain("/bot");
    });
  });
});
