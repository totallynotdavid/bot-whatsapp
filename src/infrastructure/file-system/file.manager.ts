import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { v4 as uuid } from "uuid";
import { logger } from "../../shared/logger";

// biome-ignore lint/complexity/noStaticOnlyClass: Utility class for infrastructure layer.
export class FileManager {
  private static TEMP_DIR = join(tmpdir(), "whatsapp-bot");

  static async initialize(): Promise<void> {
    if (!existsSync(FileManager.TEMP_DIR)) {
      await mkdir(FileManager.TEMP_DIR, { recursive: true });
    }
  }

  static async saveBuffer(buffer: Buffer, extension: string): Promise<string> {
    await FileManager.initialize();

    const filename = `${uuid()}.${extension}`;
    const path = join(FileManager.TEMP_DIR, filename);

    await writeFile(path, buffer);
    return path;
  }

  static getPath(extension: string): string {
    return join(FileManager.TEMP_DIR, `${uuid()}.${extension}`);
  }

  static async cleanup(path: string): Promise<void> {
    try {
      if (existsSync(path)) {
        await rm(path, { force: true });
      }
    } catch (err) {
      logger.warn("Cleanup failed", { path, err });
    }
  }
}
