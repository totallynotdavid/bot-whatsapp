import { CommandRouter } from "../../core/router";
import type {
  CommandContext,
  CommandResult,
  CommandHandler,
} from "../../types/handler";
import { Rank } from "../../types/permissions";

/**
 * Injects the router so the command can list available routes
 */
export function createHelpHandler(router: CommandRouter): CommandHandler {
  return async (ctx: CommandContext): Promise<CommandResult> => {
    const { user, args } = ctx;

    if (args.length > 0) {
      const cmdName = args[0];
      const route = router.resolve(cmdName);

      if (!route) {
        return {
          type: "error",
          message: `Command '${cmdName}' not found. Type /help for a list.`,
        };
      }

      if (user.rank < route.minRank) {
        return {
          type: "error",
          message: `You do not have permission to view help for '${cmdName}'.`,
        };
      }

      return {
        type: "text",
        content:
          `📖 *Help: ${cmdName}*\n\n` +
          `📝 ${route.description}\n` +
          `⌨️ Usage: /${route.usage}\n` +
          `🔒 Required rank: ${Rank[route.minRank]}`,
      };
    }

    const routes = router.getRoutes();
    const visibleCommands: string[] = [];

    for (const [cmd, def] of routes) {
      // Only show commands the user can execute
      if (user.rank >= def.minRank) {
        visibleCommands.push(`/${cmd}`);
      }
    }

    return {
      type: "text",
      content:
        `🤖 *Bot commands*\n\n` +
        `Here are the commands available to you (${Rank[user.rank]}):\n\n` +
        visibleCommands.sort().join("\n") +
        `\n\nType /help <command> for more details.`,
    };
  };
}
