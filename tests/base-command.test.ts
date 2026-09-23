import { afterEach, expect, test, vi } from "vitest";
import { BaseCommand } from "../src/application/commands/base-command";
import type {
  CommandContext,
  CommandMetadata,
  CommandResult,
} from "../src/domain/command";
import { Rank } from "../src/domain/user";
import { MESSAGES } from "../src/i18n/es";
import { REGULAR_PHONE, dm, makeBot } from "./fixtures";

class FailingCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "boom",
    aliases: [],
    minRank: Rank.REGULAR,
    description: "Always fails",
    usage: "boom",
    isHeavyOperation: false,
  };

  protected async executeImpl(
    _context: CommandContext
  ): Promise<CommandResult> {
    throw new Error("upstream exploded");
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
