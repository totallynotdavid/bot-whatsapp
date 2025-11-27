import type { Client } from "whatsapp-web.js";
import type {
  IMediaValidator,
  MediaValidationResult,
} from "./media-validator.interface";
import { MEDIA, PERFORMANCE } from "../../config/constants";
import { logger } from "../monitoring/logger";

export class MediaValidator implements IMediaValidator {
  constructor(private readonly client: Client) {}

  async validateMedia(messageId: string): Promise<MediaValidationResult> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Media validation timeout"));
        }, PERFORMANCE.EXTERNAL_API_TIMEOUT_MS);
      });

      const validationPromise = this.performValidation(messageId);

      return await Promise.race([validationPromise, timeoutPromise]);
    } catch (error) {
      logger.error("Media validation failed", error, { messageId });

      return {
        valid: false,
        reason: "No se pudo validar el medio.",
      };
    }
  }

  private async performValidation(
    messageId: string
  ): Promise<MediaValidationResult> {
    const message = await this.client.getMessageById(messageId);

    if (!message.hasMedia) {
      return {
        valid: false,
        reason: "El mensaje no contiene ningún medio.",
      };
    }

    const media = await message.downloadMedia();
    const sizeBytes = Buffer.from(media.data, "base64").length;

    if (sizeBytes > MEDIA.MAX_SIZE_BYTES) {
      return {
        valid: false,
        reason: `El archivo es muy grande. Máximo ${MEDIA.MAX_SIZE_MB}MB.`,
        sizeBytes,
        mimeType: media.mimetype,
      };
    }

    return {
      valid: true,
      sizeBytes,
      mimeType: media.mimetype,
    };
  }
}
