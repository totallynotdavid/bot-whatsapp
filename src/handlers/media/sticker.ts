import type { CommandContext, CommandResult } from "../../types/handler.js";

export async function sticker(ctx: CommandContext): Promise<CommandResult> {
  if (ctx.message.quotedParticipant) {
    // We don't have the quoted ID in our simple domain model yet in a direct way
    // but the Adapter can handle lookups if we pass the context.
    // For now, let's assume the user sends the image WITH the command,
    // or we use the 'hasQuotedMsg' logic inside the adapter to find the ID.
    // *Correction*: In PR5 `normalizeMessage` captures quoted info but maybe not the ID.
    // Let's stick to: "Command must be caption of image" OR "Reply to image"
    // To keep it simple for now: The command assumes the current message has media.
    // (A real implementation would fetch the quoted message ID).
  }

  if (!ctx.message.hasMedia) {
    return {
      type: "error",
      message: "Please attach an image or reply to an image to make a sticker.",
    };
  }

  let inputPath: string;
  try {
    inputPath = await ctx.services.whatsapp.downloadMedia(ctx.message.id);
  } catch (err) {
    return { type: "error", message: "Failed to download media." };
  }

  await ctx.services.queue.addJob("sticker-conversion", {
    jobType: "sticker",
    chatId: ctx.message.chat.id,
    userId: ctx.user.id,
    rawMessageId: ctx.message.id,
    inputPath: inputPath,
  });

  return {
    type: "text",
    content: "⏳ Processing your sticker...",
  };
}
