export interface MediaValidationResult {
  valid: boolean;
  reason?: string;
  sizeBytes?: number;
  mimeType?: string;
}

export interface IMediaValidator {
  validateMedia(messageId: string): Promise<MediaValidationResult>;
}
