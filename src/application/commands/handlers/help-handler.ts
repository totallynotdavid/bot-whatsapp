import type { ICommandHandler } from "../command-handler.interface";
import type { CommandContext } from "../dto/command-context.dto";
import type { CommandResult } from "../dto/command-result.dto";
import type { CommandDependencies } from "../dto/command-dependencies.dto";
import type { CommandRegistry } from "../command-registry";
import { Rank, canExecuteCommand } from "../../../domain/value-objects/rank.vo";
import { MESSAGES_ES } from "../../../shared/i18n/messages-es";

export class HelpHandler implements ICommandHandler {
  readonly metadata = {
    name: "help",
    aliases: ["h", "ayuda"],
    minRank: Rank.REGULAR,
    description: "Muestra la lista de comandos disponibles",
    usage: "help [comando]",
  };

  constructor(
    private readonly deps: CommandDependencies,
    private readonly registry: CommandRegistry
  ) {}

  async execute(context: CommandContext): Promise<CommandResult> {
    const targetCommandName = context.args[0];

    if (targetCommandName) {
      return this.showCommandHelp(targetCommandName, context.user.rank);
    }

    return this.showAllCommands(context.user.rank);
  }

  private showCommandHelp(commandName: string, userRank: Rank): CommandResult {
    const handler = this.registry.resolve(commandName);

    if (!handler) {
      const suggestions = this.registry.suggestSimilar(commandName);
      const suggestionText =
        suggestions.length > 0
          ? `\n\n¿Quisiste decir: ${suggestions.map((s) => `/${s}`).join(", ")}?`
          : "";

      return {
        type: "error",
        message: `${MESSAGES_ES.errors.commandNotFound}${suggestionText}`,
      };
    }

    if (!canExecuteCommand(userRank, handler.metadata.minRank)) {
      return {
        type: "error",
        message: MESSAGES_ES.errors.permissionDenied,
      };
    }

    const content =
      `📖 *Ayuda: ${handler.metadata.name}*\n\n` +
      `📝 ${handler.metadata.description}\n` +
      `⌨️ Uso: /${handler.metadata.usage}\n` +
      `🔒 Rango mínimo: ${Rank[handler.metadata.minRank]}`;

    return { type: "text", content };
  }

  private showAllCommands(userRank: Rank): CommandResult {
    const allHandlers = this.registry.getAllCommands();
    const visibleCommands = allHandlers
      .filter((handler) =>
        canExecuteCommand(userRank, handler.metadata.minRank)
      )
      .map((handler) => `/${handler.metadata.name}`)
      .sort();

    const content =
      `${MESSAGES_ES.info.helpHeader}\n\n` +
      `Comandos disponibles (${Rank[userRank]}):\n\n` +
      visibleCommands.join("\n") +
      `\n\nEscribe /help <comando> para más detalles.`;

    return { type: "text", content };
  }
}
