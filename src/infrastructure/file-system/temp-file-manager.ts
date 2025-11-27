import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { v4 as uuid } from "uuid";
import { logger } from "../monitoring/logger";

export class TempFileManager {
  private static readonly TEMP_DIR = join(tmpdir(), "whatsapp-bot");

  static async initialize(): Promise<void> {
    if (!existsSync(TempFileManager.TEMP_DIR)) {
      await mkdir(TempFileManager.TEMP_DIR, { recursive: true });
      logger.info("Temp directory created", { path: TempFileManager.TEMP_DIR });
    }
  }

  static async saveBuffer(buffer: Buffer, extension: string): Promise<string> {
    await TempFileManager.initialize();

    const filename = `${uuid()}.${extension}`;
    const path = join(TempFileManager.TEMP_DIR, filename);

    await writeFile(path, buffer);
    return path;
  }

  static getPath(extension: string): string {
    return join(TempFileManager.TEMP_DIR, `${uuid()}.${extension}`);
  }

  static async cleanup(path: string): Promise<void> {
    try {
      if (existsSync(path)) {
        await rm(path, { force: true });
      }
    } catch (error) {
      logger.warn("Cleanup failed", { path, error });
    }
  }
}
