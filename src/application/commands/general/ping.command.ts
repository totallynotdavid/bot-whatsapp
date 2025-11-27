import type { ICommand } from "../command.interface";
import type { CommandContext, CommandServices } from "../command.interface";
import type { CommandResult } from "../../dto/command-result.dto";
import { Rank } from "../../../domain/value-objects/rank";

export class PingCommand implements ICommand {
  readonly metadata = {
    name: "ping",
    aliases: ["p"],
    minRank: Rank.REGULAR,
    description: "Verifica que el bot esté en línea",
    usage: "ping",
  };

  async execute(
    _ctx: CommandContext,
    _services: CommandServices
  ): Promise<CommandResult> {
    return {
      type: "text",
      content: "🏓 ¡Pong! El bot está en línea.",
    };
  }
}
