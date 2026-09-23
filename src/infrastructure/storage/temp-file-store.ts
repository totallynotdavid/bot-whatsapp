import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { v4 as uuid } from "uuid";
import { log } from "../../lib/logging/logger";

const TEMP_DIR_NAME = "whatsapp-bot";

export class TempFileStore {
  private readonly tempDir: string;
  private initialized = false;

  constructor() {
    this.tempDir = join(tmpdir(), TEMP_DIR_NAME);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!existsSync(this.tempDir)) {
      await mkdir(this.tempDir, { recursive: true });
      log("info", "Temp directory created", { path: this.tempDir });
    }

    this.initialized = true;
  }

  async saveBuffer(buffer: Buffer, extension: string): Promise<string> {
    await this.initialize();

    const filename = `${uuid()}.${extension}`;
    const filePath = join(this.tempDir, filename);

    await writeFile(filePath, buffer);
    return filePath;
  }

  getPath(extension: string): string {
    return join(this.tempDir, `${uuid()}.${extension}`);
  }

  async cleanup(filePath: string): Promise<void> {
    try {
      if (existsSync(filePath)) {
        await rm(filePath, { force: true });
        log("debug", "Temp file cleaned", { filePath });
      }
    } catch (error) {
      log("warn", "Cleanup failed", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
