import { LIMITS, MEDIA_TYPES } from "../../config/constants";

export interface MediaValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

export interface MediaInfo {
  readonly sizeBytes: number;
  readonly mimeType: string;
}

export function createValidResult(): MediaValidationResult {
  return { valid: true };
}

export function createInvalidResult(reason: string): MediaValidationResult {
  return { valid: false, reason };
}

export function validateMediaSize(sizeBytes: number): MediaValidationResult {
  if (sizeBytes > LIMITS.MEDIA_MAX_BYTES) {
    return createInvalidResult(
      `El archivo es muy grande. Máximo ${LIMITS.MEDIA_MAX_MB}MB.`
    );
  }
  return createValidResult();
}

export function validateMediaType(mimeType: string): MediaValidationResult {
  const isImage = MEDIA_TYPES.ALLOWED_IMAGE.includes(mimeType as any);
  const isVideo = MEDIA_TYPES.ALLOWED_VIDEO.includes(mimeType as any);
  const isAudio = MEDIA_TYPES.ALLOWED_AUDIO.includes(mimeType as any);

  if (!isImage && !isVideo && !isAudio) {
    return createInvalidResult(
      "Tipo de archivo no permitido. Solo imágenes, videos y audio."
    );
  }

  return createValidResult();
}

export function validateMedia(mediaInfo: MediaInfo): MediaValidationResult {
  const sizeValidation = validateMediaSize(mediaInfo.sizeBytes);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  const typeValidation = validateMediaType(mediaInfo.mimeType);
  if (!typeValidation.valid) {
    return typeValidation;
  }

  return createValidResult();
}
