import type { Logger } from "@bot-whatsapp/whatsapp";
import type { Command } from "../../domain/command";
import { parseCommand, type Message } from "../../domain/message";
import { COMPLETE_EMOJI } from "../../config/constants";
import type { EventLog } from "../ports/event-log";
import type { ReplySender } from "../ports/reply-sender";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class MessageHandler {
  private readonly commands = new Map<string, Command>();

  constructor(
    commands: readonly Command[],
    private readonly sender: Pick<ReplySender, "sendReaction">,
    private readonly events: EventLog,
    private readonly prefix: string,
    private readonly log: Logger,
    private readonly now: () => Date
  ) {
    for (const command of commands) {
      if (this.commands.has(command.name)) {
        throw new Error(`Command already registered: ${command.name}`);
      }
      this.commands.set(command.name, command);
    }
  }

  isCommand(body: string): boolean {
    return parseCommand(body, this.prefix) !== null;
  }

  // Never rejects: a message that fails is logged and the next one still runs.
  async handle(message: Message): Promise<void> {
    if (!message.isGroup) {
      return;
    }

    const parsed = parseCommand(message.body, this.prefix);
    if (!parsed) {
      return;
    }

    try {
      const command = this.commands.get(parsed.name);
      if (!command) {
        await this.recordFailure(
          message,
          new Error(`Unrecognized command: ${parsed.name}`)
        );
        return;
      }

      await Promise.all([
        this.recordUsage(message, parsed.name),
        command.run(message).then(() => this.react(message)),
      ]);
    } catch (error) {
      this.log("error", "Message processing failed", {
        messageId: message.id,
        error: describeError(error),
      });
      await this.recordFailure(message, error);
    }
  }

  private async react(message: Message): Promise<void> {
    await this.sender.sendReaction(message.id, COMPLETE_EMOJI);
  }

  private async recordUsage(message: Message, name: string): Promise<void> {
    await this.events
      .commandUsed({
        commandId: `${this.prefix}${name}`,
        commandName: name,
        message,
        at: this.now(),
      })
      .catch((error: unknown) => this.logEventFailure("usage", error));
  }

  private async recordFailure(message: Message, error: unknown): Promise<void> {
    await this.events
      .failed({ message, error, at: this.now() })
      .catch((failure: unknown) => this.logEventFailure("error", failure));
  }

  private logEventFailure(kind: string, error: unknown): void {
    this.log("warn", "Could not write to the event log", {
      kind,
      error: describeError(error),
    });
  }
}
