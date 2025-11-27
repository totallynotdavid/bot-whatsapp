import type { ICommandHandler } from "../command-handler.interface";
import type { CommandContext } from "../dto/command-context.dto";
import type { CommandResult } from "../dto/command-result.dto";
import type { CommandDependencies } from "../dto/command-dependencies.dto";
import { Rank } from "../../../domain/value-objects/rank.vo";
import { MESSAGES_ES } from "../../../shared/i18n/messages-es";

export class PingHandler implements ICommandHandler {
  readonly metadata = {
    name: "ping",
    aliases: ["p"],
    minRank: Rank.REGULAR,
    description: "Verifica que el bot esté en línea",
    usage: "ping",
  };

  constructor(_deps: CommandDependencies) {}

  async execute(_context: CommandContext): Promise<CommandResult> {
    return {
      type: "text",
      content: MESSAGES_ES.info.botOnline,
    };
  }
}
