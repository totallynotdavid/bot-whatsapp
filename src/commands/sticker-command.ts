import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../core/types";
import { Rank } from "../core/types";
import type { QueueAdapter } from "../adapters/queue-adapter";
import type { WhatsAppSender } from "../adapters/whatsapp-sender";
import { LIMITS, MEDIA_TYPES } from "../config";
import { log } from "../lib/logger";

interface StickerDependencies {
  queueAdapter: QueueAdapter;
  sender: WhatsAppSender;
}

export class StickerCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "sticker",
    aliases: ["s", "stiker"],
    minRank: Rank.REGULAR,
    description: "Convierte una imagen o video en sticker",
    usage: "sticker (envía con imagen/video o responde a una)",
    isHeavyOperation: true,
  };

  constructor(private readonly deps: StickerDependencies) {
    super();
  }

  protected async executeImpl(context: CommandContext): Promise<CommandResult> {
    if (!this.requiresMedia(context)) {
      return {
        type: "error",
        userMessage:
          "Envía o responde a una imagen/video para crear un sticker.",
      };
    }

    const targetMessageId = context.message.hasMedia
      ? context.message.id
      : context.message.quotedMessageId!;

    const validation = await this.validateMedia(targetMessageId);

    if (!validation.valid) {
      return {
        type: "error",
        userMessage: validation.reason || "El medio no es válido.",
      };
    }

    await this.deps.queueAdapter.addJob("sticker", {
      messageId: context.message.id,
      chatId: context.message.chatId,
      userId: context.user.phoneNumber,
      targetMessageId,
    });

    log("info", "Sticker job queued", {
      messageId: context.message.id,
      userId: context.user.phoneNumber,
    });

    return {
      type: "queued",
      queueMessage: "⏳ Procesando tu sticker...",
    };
  }

  private async validateMedia(
    messageId: string
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      const mediaInfo = await this.deps.sender.getMediaInfo(messageId);

      if (!mediaInfo) {
        return {
          valid: false,
          reason: "No se pudo obtener información del medio.",
        };
      }

      if (mediaInfo.size > LIMITS.MEDIA_MAX_BYTES) {
        return {
          valid: false,
          reason: `El archivo es muy grande. Máximo ${LIMITS.MEDIA_MAX_MB}MB.`,
        };
      }

      const isAllowedType =
        MEDIA_TYPES.ALLOWED_IMAGE.includes(mediaInfo.mimeType as any) ||
        MEDIA_TYPES.ALLOWED_VIDEO.includes(mediaInfo.mimeType as any);

      if (!isAllowedType) {
        return { valid: false, reason: "Solo se aceptan imágenes y videos." };
      }

      return { valid: true };
    } catch (error) {
      log("error", "Media validation failed", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });

      return { valid: false, reason: "No se pudo validar el medio." };
    }
  }
}
