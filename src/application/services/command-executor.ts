import type {
  CommandHandler,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import type { Message } from "../../domain/message";
import { parseCommand } from "../../domain/message";
import type { UserService } from "./user-service";
import type { PermissionChecker } from "./permission-checker";
import { calculateSimilarity } from "../../lib/utils/text-similarity";
import {
  MIN_COMMAND_SIMILARITY,
  MAX_COMMAND_SUGGESTIONS,
} from "../../config/constants";
import { MESSAGES } from "../../i18n/es";

export class CommandExecutor {
  private readonly commandsByName = new Map<string, CommandHandler>();
  private readonly commandsByAlias = new Map<string, string>();

  constructor(
    private readonly userService: UserService,
    private readonly permissionChecker: PermissionChecker,
    private readonly commandPrefix: string
  ) {}

  registerCommand(handler: CommandHandler): void {
    const normalizedName = this.normalize(handler.metadata.name);

    if (this.commandsByName.has(normalizedName)) {
      throw new Error(`Command already registered: ${handler.metadata.name}`);
    }

    this.commandsByName.set(normalizedName, handler);

    for (const alias of handler.metadata.aliases) {
      const normalizedAlias = this.normalize(alias);

      if (this.commandsByAlias.has(normalizedAlias)) {
        throw new Error(`Alias already registered: ${alias}`);
      }

      this.commandsByAlias.set(normalizedAlias, normalizedName);
    }
  }

  async execute(message: Message): Promise<CommandResult | null> {
    const parsed = parseCommand(message.body, this.commandPrefix);

    if (!parsed) {
      return null;
    }

    const handler = this.routeCommand(parsed.name);

    if (!handler) {
      return this.handleUnknownCommand(parsed.name);
    }

    const user = await this.userService.getUser(message.senderId);

    const permissionResult = await this.permissionChecker.checkPermission(
      user,
      handler.metadata.minRank
    );

    if (!permissionResult.allowed) {
      return {
        type: "error",
        userMessage:
          permissionResult.denialReason || MESSAGES.errors.permissionDenied,
      };
    }

    const context: CommandContext = {
      message,
      user,
      args: parsed.args,
    };

    return await handler.execute(context);
  }

  getAllHandlers(): CommandHandler[] {
    return Array.from(this.commandsByName.values());
  }

  getHandler(commandName: string): CommandHandler | null {
    return this.routeCommand(commandName);
  }

  private routeCommand(commandName: string): CommandHandler | null {
    const normalized = this.normalize(commandName);

    const directMatch = this.commandsByName.get(normalized);
    if (directMatch) {
      return directMatch;
    }

    const canonicalName = this.commandsByAlias.get(normalized);
    if (canonicalName) {
      return this.commandsByName.get(canonicalName) || null;
    }

    return null;
  }

  private handleUnknownCommand(commandName: string): CommandResult {
    const suggestions = this.suggestSimilar(commandName);

    let errorMessage = MESSAGES.errors.commandNotFound;

    if (suggestions.length > 0) {
      const formattedSuggestions = suggestions
        .map((s) => `${this.commandPrefix}${s}`)
        .join(", ");
      errorMessage += `\n\n¿Quisiste decir: ${formattedSuggestions}?`;
    }

    return { type: "error", userMessage: errorMessage };
  }

  private suggestSimilar(commandName: string): string[] {
    const allNames = [
      ...this.commandsByName.keys(),
      ...this.commandsByAlias.keys(),
    ];

    const normalized = this.normalize(commandName);

    return allNames
      .map((name) => ({
        name,
        similarity: calculateSimilarity(normalized, name),
      }))
      .filter((item) => item.similarity >= MIN_COMMAND_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, MAX_COMMAND_SUGGESTIONS)
      .map((item) => item.name);
  }

  private normalize(name: string): string {
    return name.toLowerCase().trim();
  }
}
