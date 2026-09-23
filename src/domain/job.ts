export interface BaseJobData {
  readonly messageId: string;
  readonly chatId: string;
  readonly userId: string;
}

export interface StickerJobData extends BaseJobData {
  readonly targetMessageId: string;
}

export interface DocsJobData extends BaseJobData {
  readonly mirror: string;
  readonly md5: string;
  readonly format: string;
  readonly title: string;
  readonly author?: string;
}

export interface SpotifyJobData extends BaseJobData {
  readonly query: string;
}

export type JobData = StickerJobData | DocsJobData | SpotifyJobData;

export interface JobResult {
  readonly success: boolean;
  readonly outputFilePath?: string;
  readonly caption?: string;
  readonly errorMessage?: string;
  readonly resultType?: "sticker" | "media" | "audio";
}

export function createSuccessResult(
  outputFilePath: string,
  resultType: JobResult["resultType"],
  caption?: string
): JobResult {
  return { success: true, outputFilePath, resultType, caption };
}

export function createFailureResult(errorMessage: string): JobResult {
  return { success: false, errorMessage };
}
