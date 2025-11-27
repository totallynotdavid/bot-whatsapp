import type { ICommand } from "../command.interface";
import type { CommandContext, CommandServices } from "../command.interface";
import type { CommandResult } from "../../dto/command-result.dto";
import type { CommandRegistry } from "../command.registry";
import { Rank, canExecute } from "../../../domain/value-objects/rank";

export class HelpCommand implements ICommand {
  readonly metadata = {
    name: "help",
    aliases: ["h", "ayuda"],
    minRank: Rank.REGULAR,
    description: "Muestra la lista de comandos disponibles",
    usage: "help [comando]",
  };

  constructor(private registry: CommandRegistry) {}

  async execute(
    ctx: CommandContext,
    _services: CommandServices
  ): Promise<CommandResult> {
    const targetName = ctx.args[0];

    if (targetName) {
      return this.showCommandHelp(targetName, ctx.user.rank);
    }

    return this.showAllCommands(ctx.user.rank);
  }

  private showCommandHelp(name: string, userRank: Rank): CommandResult {
    const command = this.registry.resolve(name);

    if (!command) {
      const suggestions = this.registry.suggestSimilar(name);
      const suggestionText =
        suggestions.length > 0
          ? `\n\n¿Quisiste decir: ${suggestions.map((s) => `/${s}`).join(", ")}?`
          : "";

      return {
        type: "error",
        message: `Comando '${name}' no encontrado.${suggestionText}`,
      };
    }

    if (!canExecute(userRank, command.metadata.minRank)) {
      return {
        type: "error",
        message: "No tienes permiso para ver este comando.",
      };
    }

    return {
      type: "text",
      content:
        `📖 *Ayuda: ${command.metadata.name}*\n\n` +
        `📝 ${command.metadata.description}\n` +
        `⌨️ Uso: /${command.metadata.usage}\n` +
        `🔒 Rango mínimo: ${Rank[command.metadata.minRank]}`,
    };
  }

  private showAllCommands(userRank: Rank): CommandResult {
    const allCommands = this.registry.getAllCommands();
    const visible = allCommands
      .filter((cmd) => canExecute(userRank, cmd.metadata.minRank))
      .map((cmd) => `/${cmd.metadata.name}`)
      .sort();

    return {
      type: "text",
      content:
        `🤖 *Comandos del bot*\n\n` +
        `Comandos disponibles (${Rank[userRank]}):\n\n` +
        visible.join("\n") +
        `\n\nEscribe /help <comando> para más detalles.`,
    };
  }
}
