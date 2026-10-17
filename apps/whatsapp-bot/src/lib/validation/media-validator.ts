import type { MediaInfo } from "@bot-whatsapp/whatsapp";
import { LIMITS, MEDIA_TYPES } from "../../config/constants";

const ALLOWED_MIME_TYPES: readonly string[] = [
  ...MEDIA_TYPES.ALLOWED_IMAGE,
  ...MEDIA_TYPES.ALLOWED_VIDEO,
];

export function validateMedia(mediaInfo: MediaInfo): string | null {
  if (mediaInfo.sizeBytes > LIMITS.MEDIA_MAX_BYTES) {
    return `El archivo es muy grande. Máximo ${LIMITS.MEDIA_MAX_MB}MB.`;
  }
  if (!ALLOWED_MIME_TYPES.includes(mediaInfo.mimeType)) {
    return "Tipo de archivo no permitido. Solo imágenes y videos.";
  }
  return null;
}
