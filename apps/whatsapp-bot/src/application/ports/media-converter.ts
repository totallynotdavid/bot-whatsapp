export interface MediaConverter {
  gifToMp4(inputPath: string, outputPath: string): Promise<void>;
}
