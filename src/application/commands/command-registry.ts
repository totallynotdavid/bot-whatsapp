import type { ICommandHandler } from "./command-handler.interface";
import { calculateSimilarity } from "../../shared/utils/string-similarity.util";
import { logger } from "../../infrastructure/monitoring/logger";

export class CommandRegistry {
  private readonly commands = new Map<string, ICommandHandler>();
  private readonly aliases = new Map<string, string>();

  register(handler: ICommandHandler): void {
    const { name, aliases } = handler.metadata;

    this.validateHandler(handler);

    const normalizedName = this.normalizeName(name);

    if (this.commands.has(normalizedName)) {
      throw new Error(`Command already registered: ${name}`);
    }

    this.commands.set(normalizedName, handler);

    for (const alias of aliases) {
      const normalizedAlias = this.normalizeName(alias);

      if (this.aliases.has(normalizedAlias)) {
        throw new Error(`Alias already registered: ${alias}`);
      }

      this.aliases.set(normalizedAlias, normalizedName);
    }

    logger.debug("Command registered", {
      name,
      aliases,
      minRank: handler.metadata.minRank,
    });
  }

  resolve(name: string): ICommandHandler | null {
    const normalized = this.normalizeName(name);

    const directMatch = this.commands.get(normalized);
    if (directMatch) {
      return directMatch;
    }

    const canonicalName = this.aliases.get(normalized);
    if (canonicalName) {
      return this.commands.get(canonicalName) || null;
    }

    return null;
  }

  getAllCommands(): ICommandHandler[] {
    return Array.from(this.commands.values());
  }

  suggestSimilar(
    name: string,
    maxSuggestions = 3,
    minSimilarity = 0.6
  ): string[] {
    const allNames = [
      ...Array.from(this.commands.keys()),
      ...Array.from(this.aliases.keys()),
    ];

    const normalized = this.normalizeName(name);

    return allNames
      .map((cmd) => ({
        name: cmd,
        similarity: calculateSimilarity(normalized, cmd),
      }))
      .filter((item) => item.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxSuggestions)
      .map((item) => item.name);
  }

  private normalizeName(name: string): string {
    return name.toLowerCase().trim();
  }

  private validateHandler(handler: ICommandHandler): void {
    if (typeof handler.execute !== "function") {
      throw new Error("Handler must implement execute method");
    }

    if (!handler.metadata.name || handler.metadata.name.length === 0) {
      throw new Error("Handler must have a valid name");
    }

    if (
      !handler.metadata.description ||
      handler.metadata.description.length === 0
    ) {
      throw new Error("Handler must have a valid description");
    }

    if (typeof handler.metadata.minRank !== "number") {
      throw new Error("Handler must have a valid minRank");
    }
  }
}
