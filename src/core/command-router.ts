import type { CommandHandler } from "../commands/types";
import { calculateSimilarity } from "../lib/utils";

export class CommandRouter {
  private readonly commandsByName = new Map<string, CommandHandler>();
  private readonly commandsByAlias = new Map<string, string>();

  register(handler: CommandHandler): void {
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

  route(commandName: string): CommandHandler | null {
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

  getAllHandlers(): CommandHandler[] {
    return Array.from(this.commandsByName.values());
  }

  suggestSimilar(commandName: string, maxSuggestions = 3): string[] {
    const allNames = [
      ...this.commandsByName.keys(),
      ...this.commandsByAlias.keys(),
    ];

    const normalized = this.normalize(commandName);
    const MIN_SIMILARITY = 0.6;

    return allNames
      .map((name) => ({
        name,
        similarity: calculateSimilarity(normalized, name),
      }))
      .filter((item) => item.similarity >= MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxSuggestions)
      .map((item) => item.name);
  }

  private normalize(name: string): string {
    return name.toLowerCase().trim();
  }
}
