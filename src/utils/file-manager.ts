import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { logger } from "./logger.js";

export class FileManager {
  static async createTempDir(prefix: string): Promise<string> {
    const path = join(tmpdir(), `bot-${prefix}-`);
    return await mkdtemp(path);
  }

  static async cleanup(path: string): Promise<void> {
    try {
      await rm(path, { recursive: true, force: true });
    } catch (err) {
      logger.warn(`Failed to cleanup temp path: ${path}`, { err });
    }
  }
}
