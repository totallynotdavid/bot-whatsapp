import { writeFile, rm, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { v4 as uuid } from "uuid";
import { logger } from "../../shared/logger";

export class FileManager {
  private static TEMP_DIR = join(tmpdir(), "whatsapp-bot");

  static async initialize(): Promise<void> {
    if (!existsSync(this.TEMP_DIR)) {
      await mkdir(this.TEMP_DIR, { recursive: true });
    }
  }

  static async saveBuffer(buffer: Buffer, extension: string): Promise<string> {
    await this.initialize();

    const filename = `${uuid()}.${extension}`;
    const path = join(this.TEMP_DIR, filename);

    await writeFile(path, buffer);
    return path;
  }

  static getPath(extension: string): string {
    return join(this.TEMP_DIR, `${uuid()}.${extension}`);
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
