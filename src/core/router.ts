import { Rank } from "../types/permissions";
import type { CommandHandler } from "../types/handler";

export interface RouteDefinition {
  handler: CommandHandler;
  minRank: Rank;
  description: string;
  usage: string;
}

export class CommandRouter {
  private routes = new Map<string, RouteDefinition>();
  private aliases = new Map<string, string>();

  /**
   * explicitly register a command with metadata
   * @param command - The primary command name (e.g., 'help')
   * @param minRank - Minimum rank required to execute
   * @param handler - The function to run
   * @param aliasList - Optional alternative names (e.g., ['h', 'info'])
   */
  register(
    command: string,
    minRank: Rank,
    handler: CommandHandler,
    metadata: { description: string; usage?: string; aliases?: string[] }
  ): void {
    const def: RouteDefinition = {
      handler,
      minRank,
      description: metadata.description,
      usage: metadata.usage || command,
    };

    const cmdLower = command.toLowerCase();
    this.routes.set(cmdLower, def);

    if (metadata.aliases) {
      for (const alias of metadata.aliases) {
        this.aliases.set(alias.toLowerCase(), cmdLower);
      }
    }
  }

  /**
   * Resolve a command name to its definition
   */
  resolve(command: string): RouteDefinition | null {
    const cmd = command.toLowerCase();

    if (this.routes.has(cmd)) {
      return this.routes.get(cmd)!;
    }

    const canonical = this.aliases.get(cmd);
    if (canonical && this.routes.has(canonical)) {
      return this.routes.get(canonical)!;
    }

    return null;
  }

  /**
   * Get all registered routes (for Help command)
   */
  getRoutes(): Map<string, RouteDefinition> {
    return this.routes;
  }
}
