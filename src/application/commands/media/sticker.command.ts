import { Rank } from "../../../domain/value-objects/rank";
import type { CommandResult } from "../../dto/command-result.dto";
import type { ICommandServices } from "../../interfaces/command-services.interface";
import type { CommandContext, ICommand } from "../command.interface";

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

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
    services: ICommandServices
  ): Promise<CommandResult> {
    if (!ctx.message.hasMedia || ctx.message.mediaType !== "image") {
      return {
        type: "error",
        message: "Envía o responde a una imagen para crear un sticker.",
      };
    }

    const mediaInfo = await services.whatsappClient.getMediaInfo(
      ctx.message.id
    );

    if (!mediaInfo) {
      return {
        type: "error",
        message: "No pude obtener información de la imagen.",
      };
    }

    if (mediaInfo.size > MAX_IMAGE_SIZE_BYTES) {
      return {
        type: "error",
        message: `La imagen es muy grande. Máximo ${MAX_IMAGE_SIZE_MB}MB.`,
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
