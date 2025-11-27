import { logger } from "../../shared/logger";
import { calculateSimilarity } from "../../shared/utils/string-similarity";
import type { ICommandRegistry } from "../interfaces/command-registry.interface";
import type { ICommand } from "./command.interface";

export class CommandRegistry implements ICommandRegistry {
  private commands = new Map<string, ICommand>();
  private aliases = new Map<string, string>();

  register(command: ICommand): void {
    const { name, aliases } = command.metadata;

    if (!this.isValidCommand(command)) {
      throw new Error(`Invalid command: ${name}`);
    }

    const lowerName = name.toLowerCase();

    if (this.commands.has(lowerName)) {
      throw new Error(`Command already registered: ${name}`);
    }

    this.commands.set(lowerName, command);

    for (const alias of aliases) {
      const lowerAlias = alias.toLowerCase();

      if (this.aliases.has(lowerAlias)) {
        throw new Error(`Alias already registered: ${alias}`);
      }

      this.aliases.set(lowerAlias, lowerName);
    }

    logger.debug("Command registered", {
      name,
      aliases,
      minRank: command.metadata.minRank,
    });
  }

  resolve(name: string): ICommand | null {
    const lower = name.toLowerCase();

    if (this.commands.has(lower)) {
      return this.commands.get(lower)!;
    }

    const canonical = this.aliases.get(lower);
    if (canonical) {
      return this.commands.get(canonical) || null;
    }

    return null;
  }

  getAllCommands(): ICommand[] {
    return Array.from(this.commands.values());
  }

  suggestSimilar(name: string): string[] {
    const allNames = [...this.commands.keys(), ...this.aliases.keys()];
    const lowerName = name.toLowerCase();

    return allNames
      .map((cmd) => ({
        name: cmd,
        similarity: calculateSimilarity(lowerName, cmd),
      }))
      .filter((item) => item.similarity > 0.6)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map((item) => item.name);
  }

  private isValidCommand(command: ICommand): boolean {
    return (
      typeof command.execute === "function" &&
      command.metadata.name.length > 0 &&
      command.metadata.description.length > 0 &&
      typeof command.metadata.minRank === "number"
    );
  }
}
