import { Rank } from "../../../domain/value-objects/rank";
import type { CommandResult } from "../../dto/command-result.dto";
import type { ICommandServices } from "../../interfaces/command-services.interface";
import type { CommandContext, ICommand } from "../command.interface";

const MAX_MEDIA_SIZE_MB = 10;
const MAX_MEDIA_SIZE_BYTES = MAX_MEDIA_SIZE_MB * 1024 * 1024;

export class StickerCommand implements ICommand {
  readonly metadata = {
    name: "sticker",
    aliases: ["s", "stiker"],
    minRank: Rank.REGULAR,
    description: "Convierte una imagen o video en sticker",
    usage: "sticker (envía con imagen/video o responde a una imagen/video)",
    requiresMedia: true,
    mediaTypes: ["image", "video"],
  };

  async execute(
    ctx: CommandContext,
    services: ICommandServices
  ): Promise<CommandResult> {
    if (!ctx.message.hasMedia && !ctx.message.quotedMessageId) {
      return {
        type: "error",
        message: "Envía o responde a una imagen o video para crear un sticker.",
      };
    }

    const mediaMessageId = ctx.message.hasMedia
      ? ctx.message.id
      : ctx.message.quotedMessageId!;

    const mediaInfo =
      await services.whatsappClient.getMediaInfo(mediaMessageId);

    if (!mediaInfo) {
      return {
        type: "error",
        message: "No pude obtener información del medio.",
      };
    }

    if (
      !mediaInfo.mimeType.startsWith("image/") &&
      !mediaInfo.mimeType.startsWith("video/")
    ) {
      return {
        type: "error",
        message: "Solo se aceptan imágenes y videos.",
      };
    }

    if (mediaInfo.size > MAX_MEDIA_SIZE_BYTES) {
      return {
        type: "error",
        message: `El medio es muy grande. Máximo ${MAX_MEDIA_SIZE_MB}MB.`,
      };
    }

    await services.queueService.addJob("sticker", {
      messageId: ctx.message.id,
      chatId: ctx.message.chat.id,
      userId: ctx.user.phoneNumber.toString(),
      mediaMessageId,
    });

    return {
      type: "text",
      content: "⏳ Procesando tu sticker...",
    };
  }
}
