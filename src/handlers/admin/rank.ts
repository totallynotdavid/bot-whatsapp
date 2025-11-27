import type { CommandContext, CommandResult } from "../../types/handler";
import { Rank } from "../../types/permissions";

/**
 * Set Premium Command
 * Usage: /addpremium <days> (replying to user)
 */
export async function addPremium(ctx: CommandContext): Promise<CommandResult> {
  const targetId =
    ctx.message.quotedParticipant ||
    (ctx.message.mentions.length > 0 ? ctx.message.mentions[0] : null);

  if (!targetId) {
    return { type: "error", message: "Reply to a user to give them premium." };
  }

  const daysStr = ctx.args[0];
  const days = parseInt(daysStr, 10);

  if (isNaN(days) || days <= 0) {
    return { type: "error", message: "Please provide a valid number of days." };
  }

  try {
    await ctx.services.database.setUserRank(targetId, Rank.PREMIUM, days);

    return {
      type: "text",
      content: `🌟 Added ${days} days of premium to user.`,
    };
  } catch (err) {
    return { type: "error", message: "Database error while updating rank." };
  }
}
