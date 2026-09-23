import { BaseCommand } from "./base-command";
import type {
  CommandMetadata,
  CommandContext,
  CommandResult,
} from "../../domain/command";
import { Rank } from "../../domain/user";
import type { StickerJobData } from "../../domain/job";
import type { JobScheduler } from "../services/job-scheduler";
import type { WhatsAppSender } from "../../infrastructure/whatsapp/sender";
import { validateMedia } from "../../lib/validation/media-validator";
import { log } from "../../lib/logging/logger";

export class StickerCommand extends BaseCommand {
  readonly metadata: CommandMetadata = {
    name: "sticker",
    aliases: ["s", "stiker"],
    minRank: Rank.REGULAR,
    description: "Convierte una imagen o video en sticker",
    usage: "sticker (envía con imagen/video o responde a una)",
    isHeavyOperation: true,
  };

  constructor(
    private readonly jobScheduler: JobScheduler,
    private readonly sender: WhatsAppSender
  ) {
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

    const mediaInfo = await this.sender.getMediaInfo(targetMessageId);

    if (!mediaInfo) {
      return {
        type: "error",
        userMessage: "No se pudo obtener información del medio.",
      };
    }

    const validation = validateMedia(mediaInfo);

    if (!validation.valid) {
      return {
        type: "error",
        userMessage: validation.reason || "El medio no es válido.",
      };
    }

    const jobData: StickerJobData = {
      messageId: context.message.id,
      chatId: context.message.chatId,
      userId: context.user.phoneNumber,
      targetMessageId,
    };

    await this.jobScheduler.scheduleStickerJob(jobData);

    log("info", "Sticker job scheduled", {
      messageId: context.message.id,
      userId: context.user.phoneNumber,
    });

    return {
      type: "queued",
      queueMessage: "⏳ Procesando tu sticker...",
    };
  }
}
