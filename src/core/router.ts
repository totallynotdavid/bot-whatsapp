import { Rank } from "../types/permissions";
import type { CommandHandler } from "../types/handler";

interface RouteDefinition {
  handler: CommandHandler;
  minRank: Rank;
}

export class CommandRouter {
  private routes = new Map<string, RouteDefinition>();
  private aliases = new Map<string, string>();

  /**
   * explicitly register a command
   * @param command - The primary command name (e.g., 'help')
   * @param minRank - Minimum rank required to execute
   * @param handler - The function to run
   * @param aliasList - Optional alternative names (e.g., ['h', 'info'])
   */
  register(
    command: string,
    minRank: Rank,
    handler: CommandHandler,
    aliasList: string[] = []
  ): void {
    const def: RouteDefinition = { handler, minRank };
    this.routes.set(command.toLowerCase(), def);

    for (const alias of aliasList) {
      this.aliases.set(alias.toLowerCase(), command.toLowerCase());
    }
  }

  /**
   * Find a route definition
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
}
