export interface PhotoStorage {
  // Resolves to the public URL of the stored photo.
  upload(managerNumber: string, photo: Buffer): Promise<string>;
}

export interface DownloadedImage {
  readonly filePath: string;
  // The file is a temp file; the caller disposes it once it is sent.
  dispose(): Promise<void>;
}

export interface ImageDownloader {
  download(url: string): Promise<DownloadedImage>;
}
