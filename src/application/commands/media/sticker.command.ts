import type { ICommand } from "../command.interface";
import type { CommandContext, CommandServices } from "../command.interface";
import type { CommandResult } from "../../dto/command-result.dto";
import { Rank } from "../../../domain/value-objects/rank";

export class StickerCommand implements ICommand {
  readonly metadata = {
    name: "sticker",
    aliases: ["s", "stiker"],
    minRank: Rank.REGULAR,
    description: "Convierte una imagen en sticker",
    usage: "sticker (envía con imagen o responde a una imagen)",
    requiresMedia: true,
    mediaTypes: ["image"],
  };

  async execute(
    ctx: CommandContext,
    services: CommandServices
  ): Promise<CommandResult> {
    if (!ctx.message.hasMedia || ctx.message.mediaType !== "image") {
      return {
        type: "error",
        message: "Envía o responde a una imagen para crear un sticker.",
      };
    }

    await services.queueService.addJob("sticker", {
      messageId: ctx.message.id,
      chatId: ctx.message.chat.id,
      userId: ctx.user.phoneNumber.toString(),
    });

    return {
      type: "text",
      content: "⏳ Procesando tu sticker...",
    };
  }
}
