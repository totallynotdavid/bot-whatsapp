import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  DownloadedImage,
  ImageDownloader,
} from "../../application/ports/photo-storage";

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// Adapters send a file by path and pick its media type from the extension, so
// the file gets the extension its content type implies.
export class RemoteImageDownloader implements ImageDownloader {
  constructor(
    private readonly fetchImage: (url: string) => Promise<Response> = fetch
  ) {}

  async download(url: string): Promise<DownloadedImage> {
    const response = await this.fetchImage(url);
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ?? ".jpg";
    const directory = await mkdtemp(join(tmpdir(), "sumibot-"));
    const filePath = join(directory, `image${extension}`);

    try {
      await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }

    return {
      filePath,
      dispose: () => rm(directory, { recursive: true, force: true }),
    };
  }
}
