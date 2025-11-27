import type { CommandContext, CommandResult } from "../types/handler.js";
import { Rank } from "../types/permissions.js";
import { config } from "../config/env.js";

type NextFn = () => Promise<CommandResult>;

/**
 * Tracks execution time and success/failure
 */
export async function logMiddleware(
  ctx: CommandContext,
  next: NextFn
): Promise<CommandResult> {
  const start = Date.now();
  const cmdName = ctx.args[0] || "unknown";

  try {
    const result = await next();
    const duration = Date.now() - start;

    if (config.LOG_LEVEL === "debug") {
      console.log(
        `CMD: ${cmdName} | User: ${ctx.user.id} | ${duration}ms | Status: ${result.type}`
      );
    }

    return result;
  } catch (err: any) {
    console.error(`CMD_CRASH: ${cmdName}`, err);
    return {
      type: "error",
      message: "Internal system error. The team has been notified.",
    };
  }
}

/**
 * Prevents unauthorized access
 */
export function guardMiddleware(requiredRank: Rank) {
  return async (ctx: CommandContext, next: NextFn): Promise<CommandResult> => {
    if (ctx.user.rank < requiredRank) {
      return {
        type: "error",
        message:
          "Permission denied: You do not have the required rank for this command.",
      };
    }
    return next();
  };
}

/**
 * Rate Limiter (stub)
 */
export async function rateLimitMiddleware(
  ctx: CommandContext,
  next: NextFn
): Promise<CommandResult> {
  // TODO: Implement Redis rate limiting here
  // For now, pass through
  return next();
}
