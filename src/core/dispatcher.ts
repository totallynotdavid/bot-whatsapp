import type { Message } from "../types/models";
import type {
  ServiceContainer,
  CommandResult,
  CommandContext,
} from "../types/handler";
import { CommandRouter } from "./router";
import { config } from "../config/env";
import {
  logMiddleware,
  guardMiddleware,
  rateLimitMiddleware,
} from "./middleware";

export class Dispatcher {
  constructor(
    private router: CommandRouter,
    private services: ServiceContainer
  ) {}

  /**
   * Main entry point for a message
   */
  async dispatch(message: Message): Promise<CommandResult | null> {
    const body = message.body.trim();
    if (!body.startsWith(config.COMMAND_PREFIX)) {
      return null;
    }

    const content = body.slice(config.COMMAND_PREFIX.length).trim();

    if (!content) {
      return null;
    }

    const parts = content.split(/\s+/);
    const commandName = parts[0];
    const args = parts.slice(1);

    if (!commandName) {
      return null;
    }

    const route = this.router.resolve(commandName);
    if (!route) {
      // TODO: We could return a "Did you mean?" suggestion
      return { type: "no-op" };
    }

    // Build command context
    const ctx: CommandContext = {
      message,
      user: message.from,
      args,
      services: this.services,
    };

    // Log -> rateLimit -> guard -> handler
    const executeHandler = () => route.handler(ctx);

    const withGuard = guardMiddleware(route.minRank)(ctx, executeHandler);
    const withRateLimit = () => rateLimitMiddleware(ctx, () => withGuard);

    return logMiddleware(ctx, withRateLimit);
  }
}
