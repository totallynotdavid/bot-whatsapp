import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { v4 as uuid } from "uuid";
import { TEMP_FILE_TTL_MS } from "../../config/constants";
import { log } from "../../lib/logging/logger";

const TEMP_DIR_NAME = "whatsapp-bot";

export class TempFileStore {
  private ready?: Promise<void>;

  constructor(
    private readonly dir = join(tmpdir(), TEMP_DIR_NAME),
    private readonly ttlMs = TEMP_FILE_TTL_MS
  ) {}

  initialize(): Promise<void> {
    this.ready ??= this.prepare();
    return this.ready;
  }

  async saveBuffer(buffer: Buffer, extension: string): Promise<string> {
    await this.initialize();
    const filePath = this.getPath(extension);
    await writeFile(filePath, buffer);
    return filePath;
  }

  getPath(extension: string): string {
    return join(this.dir, `${uuid()}.${extension}`);
  }

  async cleanup(filePath: string): Promise<void> {
    try {
      await rm(filePath, { force: true });
    } catch (error) {
      log("warn", "Cleanup failed", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async prepare(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await this.sweepExpired();
  }

  // Files past the TTL were left by a process that died before its cleanup
  // ran; nothing still in use lives that long.
  private async sweepExpired(): Promise<void> {
    const now = Date.now();
    let removed = 0;
    for (const name of await readdir(this.dir)) {
      const filePath = join(this.dir, name);
      try {
        const { mtimeMs } = await stat(filePath);
        if (now - mtimeMs > this.ttlMs) {
          await rm(filePath, { force: true, recursive: true });
          removed++;
        }
      } catch (error) {
        log("warn", "Temp file sweep failed", {
          filePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (removed > 0) {
      log("info", "Swept expired temp files", { dir: this.dir, removed });
    }
  }
}
