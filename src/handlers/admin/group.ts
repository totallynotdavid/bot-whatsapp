import type { CommandContext, CommandResult } from "../../types/handler";

/**
 * Helper to get target ID from mentions or reply
 */
function getTargetId(ctx: CommandContext): string | null {
  if (ctx.message.quotedParticipant) {
    return ctx.message.quotedParticipant;
  }
  if (ctx.message.mentions.length > 0) {
    return ctx.message.mentions[0];
  }
  return null;
}

/**
 * Kick User Command
 */
export async function kickUser(ctx: CommandContext): Promise<CommandResult> {
  if (!ctx.message.chat.isGroup) {
    return {
      type: "error",
      message: "This command can only be used in groups.",
    };
  }

  const targetId = getTargetId(ctx);
  if (!targetId) {
    return {
      type: "error",
      message: "Please reply to a message or mention a user to kick.",
    };
  }

  // Safety: Prevent kicking the bot itself or the owner
  if (targetId.includes(ctx.user.id)) {
    // Simplistic check
    return { type: "text", content: "nice try." };
  }

  const success = await ctx.services.whatsapp.kickUser(
    ctx.message.chat.id,
    targetId
  );

  if (success) {
    return { type: "text", content: "👋 User removed." };
  } else {
    return {
      type: "error",
      message: "Failed to remove user. Make sure I am an admin.",
    };
  }
}

/**
 * Promote User Command
 */
export async function promoteUser(ctx: CommandContext): Promise<CommandResult> {
  if (!ctx.message.chat.isGroup) {
    return {
      type: "error",
      message: "This command can only be used in groups.",
    };
  }

  const targetId = getTargetId(ctx);
  if (!targetId) {
    return {
      type: "error",
      message: "Please reply to a message or mention a user to promote.",
    };
  }

  const success = await ctx.services.whatsapp.promoteUser(
    ctx.message.chat.id,
    targetId
  );

  if (success) {
    return { type: "text", content: "👑 User promoted to admin." };
  } else {
    return {
      type: "error",
      message: "Failed to promote user. Check my permissions.",
    };
  }
}
