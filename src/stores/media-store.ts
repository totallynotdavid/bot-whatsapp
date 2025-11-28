import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { v4 as uuid } from "uuid";
import { log } from "../lib/logger";

export class MediaStore {
  private static readonly TEMP_DIR = join(tmpdir(), "whatsapp-bot");
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (MediaStore.initialized) return;

    if (!existsSync(MediaStore.TEMP_DIR)) {
      await mkdir(MediaStore.TEMP_DIR, { recursive: true });
      log("info", "Temp directory created", { path: MediaStore.TEMP_DIR });
    }

    MediaStore.initialized = true;
  }

  static async saveBuffer(buffer: Buffer, extension: string): Promise<string> {
    await MediaStore.initialize();

    const filename = `${uuid()}.${extension}`;
    const filePath = join(MediaStore.TEMP_DIR, filename);

    await writeFile(filePath, buffer);
    return filePath;
  }

  static getPath(extension: string): string {
    return join(MediaStore.TEMP_DIR, `${uuid()}.${extension}`);
  }

  static async cleanup(filePath: string): Promise<void> {
    try {
      if (existsSync(filePath)) {
        await rm(filePath, { force: true });
      }
    } catch (error) {
      log("warn", "Cleanup failed", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
