import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../core/types";
import { Rank, canExecuteCommand } from "../core/types";
import type { CommandRouter } from "../core/command-router";
import { MESSAGES } from "../i18n/es";

export class HelpCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "help",
    aliases: ["h", "ayuda"],
    minRank: Rank.REGULAR,
    description: "Muestra la lista de comandos disponibles",
    usage: "help [comando]",
    isHeavyOperation: false,
  };

  constructor(private readonly router: CommandRouter) {
    super();
  }

  protected async executeImpl(context: CommandContext): Promise<CommandResult> {
    const targetCommandName = context.args[0];

    if (targetCommandName) {
      return this.showCommandDetails(targetCommandName, context.user.rank);
    }

    return this.showAllCommands(context.user.rank);
  }

  private showCommandDetails(
    commandName: string,
    userRank: Rank
  ): CommandResult {
    const handler = this.router.route(commandName);

    if (!handler) {
      const suggestions = this.router.suggestSimilar(commandName);
      let message = MESSAGES.errors.commandNotFound;

      if (suggestions.length > 0) {
        message += `\n\n¿Quisiste decir: ${suggestions.map((s) => `/${s}`).join(", ")}?`;
      }

      return { type: "error", userMessage: message };
    }

    if (!canExecuteCommand(userRank, handler.metadata.minRank)) {
      return { type: "error", userMessage: MESSAGES.errors.permissionDenied };
    }

    const content =
      `📖 *Ayuda: ${handler.metadata.name}*\n\n` +
      `📝 ${handler.metadata.description}\n` +
      `⌨️ Uso: /${handler.metadata.usage}\n` +
      `🔒 Rango mínimo: ${Rank[handler.metadata.minRank]}`;

    return { type: "text", content };
  }

  private showAllCommands(userRank: Rank): CommandResult {
    const allHandlers = this.router.getAllHandlers();

    const visibleCommands = allHandlers
      .filter((handler) =>
        canExecuteCommand(userRank, handler.metadata.minRank)
      )
      .map((handler) => `/${handler.metadata.name}`)
      .sort();

    const content =
      `${MESSAGES.info.helpHeader}\n\n` +
      `Comandos disponibles (${Rank[userRank]}):\n\n` +
      visibleCommands.join("\n") +
      `\n\nEscribe /help <comando> para más detalles.`;

    return { type: "text", content };
  }
}
