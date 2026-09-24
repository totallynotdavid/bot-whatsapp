export interface TempStore {
  saveBuffer(buffer: Buffer, extension: string): Promise<string>;
  getPath(extension: string): string;
  cleanup(filePath: string): Promise<void>;
}
