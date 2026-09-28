export interface ImageUpload {
  readonly link: string;
  readonly deleteHash: string;
}

export interface ImageHost {
  isConfigured(): boolean;
  upload(imageUrl: string): Promise<ImageUpload>;
  deleteImage(deleteHash: string): Promise<void>;
}
