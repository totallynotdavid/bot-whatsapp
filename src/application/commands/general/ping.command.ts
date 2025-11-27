import { Rank } from "../../../domain/value-objects/rank";
import type { CommandResult } from "../../dto/command-result.dto";
import type {
  CommandContext,
  CommandServices,
  ICommand,
} from "../command.interface";

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
