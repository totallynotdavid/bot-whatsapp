import type { ICommandHandler } from "../command-handler.interface";
import type { CommandContext } from "../dto/command-context.dto";
import type { CommandResult } from "../dto/command-result.dto";
import type { CommandDependencies } from "../dto/command-dependencies.dto";
import { Rank } from "../../../domain/value-objects/rank.vo";
import { MEDIA } from "../../../config/constants";
import { logger } from "../../../infrastructure/monitoring/logger";

export class StickerHandler implements ICommandHandler {
  readonly metadata = {
    name: "sticker",
    aliases: ["s", "stiker"],
    minRank: Rank.REGULAR,
    description: "Convierte una imagen o video en sticker",
    usage: "sticker (envía con imagen/video o responde a una imagen/video)",
  };

  constructor(private readonly deps: CommandDependencies) {}

  async execute(context: CommandContext): Promise<CommandResult> {
    if (!context.message.hasMedia && !context.message.quotedMessageId) {
      return {
        type: "error",
        message: "Envía o responde a una imagen o video para crear un sticker.",
      };
    }

    const targetMessageId = context.message.hasMedia
      ? context.message.id
      : context.message.quotedMessageId!;

    const validation =
      await this.deps.mediaValidator.validateMedia(targetMessageId);

    if (!validation.valid) {
      return {
        type: "error",
        message: validation.reason || "El medio no es válido.",
      };
    }

    if (!this.isMediaTypeSupported(validation.mimeType!)) {
      return {
        type: "error",
        message: "Solo se aceptan imágenes y videos.",
      };
    }

    if (validation.sizeBytes! > MEDIA.MAX_SIZE_BYTES) {
      return {
        type: "error",
        message: `El medio es muy grande. Máximo ${MEDIA.MAX_SIZE_MB}MB.`,
      };
    }

    await this.deps.queueClient.addJob("sticker", {
      messageId: context.message.id,
      chatId: context.message.chat.id,
      userId: context.user.phoneNumber.toString(),
      mediaMessageId: targetMessageId,
    });

    logger.info("Sticker job queued", {
      messageId: context.message.id,
      userId: context.user.phoneNumber.toString(),
    });

    return {
      type: "text",
      content: "⏳ Procesando tu sticker...",
    };
  }

  private isMediaTypeSupported(mimeType: string): boolean {
    return (
      (MEDIA.ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimeType) ||
      (MEDIA.ALLOWED_VIDEO_TYPES as readonly string[]).includes(mimeType)
    );
  }
}
