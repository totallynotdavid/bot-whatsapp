import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank, canExecuteCommand } from "../../domain/user";
import type { CommandExecutor } from "../services/command-executor";
import { MESSAGES } from "../../i18n/es";

export class HelpCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "help",
    aliases: ["h", "ayuda"],
    minRank: Rank.REGULAR,
    description: "Muestra la lista de comandos disponibles",
    usage: "help [comando]",
    isHeavyOperation: false,
  };

  constructor(private readonly commandExecutor: CommandExecutor) {
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
    const handler = this.commandExecutor.getHandler(commandName);

    if (!handler) {
      return { type: "error", userMessage: MESSAGES.errors.commandNotFound };
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
    const allHandlers = this.commandExecutor.getAllHandlers();

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
