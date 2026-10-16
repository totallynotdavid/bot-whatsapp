import { afterEach, expect, test, vi } from "vitest";
import { BaseCommand } from "../src/application/commands/base-command";
import type {
  CommandContext,
  CommandMetadata,
  CommandResult,
} from "../src/domain/command";
import { Rank } from "../src/domain/user";
import { MESSAGES } from "../src/i18n/es";
import { OWNER_PHONE, REGULAR_PHONE, dm, makeBot } from "./fixtures";

const OWNER_CHAT = `${OWNER_PHONE}@c.us`;

class FailingCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "boom",
    aliases: [],
    minRank: Rank.REGULAR,
    description: "Always fails",
    usage: "boom",
  };

  async execute(_context: CommandContext): Promise<CommandResult> {
    throw new Error("upstream exploded");
  }
}

class SuccessfulCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "ok",
    aliases: [],
    minRank: Rank.REGULAR,
    description: "Always succeeds",
    usage: "ok",
  };

  async execute(_context: CommandContext): Promise<CommandResult> {
    return { type: "text", content: "done" };
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("a command that throws logs the error with its name and message id, then replies with the internal error", async () => {
  const errorOutput = vi.spyOn(console, "error").mockImplementation(() => {});
  const { executor } = makeBot(() => [new FailingCommand()]);

  const result = await executor.execute(dm(REGULAR_PHONE, "/boom"));

  expect(result).toEqual({
    type: "error",
    userMessage: MESSAGES.errors.internalError,
  });
  const entries = errorOutput.mock.calls.map(([line]) =>
    JSON.parse(String(line))
  );
  expect(entries).toContainEqual(
    expect.objectContaining({
      level: "error",
      message: "Command failed",
      command: "boom",
      messageId: "msg-fixed",
      error: "upstream exploded",
    })
  );
});

test("a command that succeeds does not notify the owner", async () => {
  const { executor, sender } = makeBot(() => [new SuccessfulCommand()]);

  await expect(executor.execute(dm(REGULAR_PHONE, "/ok"))).resolves.toEqual({
    type: "text",
    content: "done",
  });

  expect(sender.sentTo).toEqual([]);
});

test("a command that throws notifies the owner once", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { executor, sender } = makeBot(() => [new FailingCommand()]);

  const result = await executor.execute(dm(REGULAR_PHONE, "/boom"));

  await vi.waitFor(() => expect(sender.sentTo).toEqual([OWNER_CHAT]));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(sender.sentTo).toEqual([OWNER_CHAT]);
  expect(result).toEqual({
    type: "error",
    userMessage: MESSAGES.errors.internalError,
  });
  expect(sender.sendLog[0]).toContain("Comando: boom");
  expect(sender.sendLog[0]).toContain("Error: upstream exploded");
  expect(sender.sendLog[0]).not.toContain("/boom");
});

test("when the owner notification fails, the user still gets the error reply and the failure is only logged", async () => {
  const errorOutput = vi.spyOn(console, "error").mockImplementation(() => {});
  const { executor, sender } = makeBot(() => [new FailingCommand()]);
  sender.failNext(OWNER_CHAT);

  const result = await executor.execute(dm(REGULAR_PHONE, "/boom"));

  expect(result).toEqual({
    type: "error",
    userMessage: MESSAGES.errors.internalError,
  });
  await vi.waitFor(() =>
    expect(
      errorOutput.mock.calls.map(([line]) => JSON.parse(String(line)).message)
    ).toContain("Failed to notify owner")
  );
  expect(sender.sentTo).toEqual([]);
});
