import { writeFile, rm, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join, extname } from "path";
import { v4 as uuidv4 } from "uuid";
import { logger } from "./logger.js";

export class FileManager {
  private static TEMP_DIR = join(tmpdir(), "ironclad-bot");

  static async init() {
    if (!existsSync(this.TEMP_DIR)) {
      await mkdir(this.TEMP_DIR, { recursive: true });
    }
  }

  static async saveMedia(
    buffer: Buffer,
    mimeType: string,
    extension?: string
  ): Promise<string> {
    await this.init();
    const ext = extension || mimeType.split("/")[1] || "bin";
    const filename = `${uuidv4()}.${ext}`;
    const filePath = join(this.TEMP_DIR, filename);

    await writeFile(filePath, buffer);
    return filePath;
  }

  static getOutputPath(extension: string): string {
    return join(this.TEMP_DIR, `${uuidv4()}.${extension}`);
  }

  static async cleanup(path: string): Promise<void> {
    try {
      if (path && existsSync(path)) {
        await rm(path, { recursive: true, force: true });
      }
    } catch (err) {
      logger.warn(`Failed to cleanup temp path: ${path}`, { err });
    }
  }
}
