import { mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { TempFileStore } from "../src/infrastructure/storage/temp-file-store";
import { loadTestConfig } from "./fixtures";

const TTL_MS = 60_000;

loadTestConfig();

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "temp-file-store-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("startup sweeps files older than the TTL and keeps newer ones", async () => {
  const orphan = join(dir, "orphan.webp");
  const recent = join(dir, "recent.webp");
  await writeFile(orphan, "old");
  await writeFile(recent, "new");
  const longAgo = new Date(Date.now() - 2 * TTL_MS);
  await utimes(orphan, longAgo, longAgo);

  await new TempFileStore(dir, TTL_MS).initialize();

  expect(await readdir(dir)).toEqual(["recent.webp"]);
});

test("cleanup of a file that is already gone does not throw", async () => {
  const store = new TempFileStore(dir, TTL_MS);
  const filePath = await store.saveBuffer(Buffer.from("x"), "ogg");

  await store.cleanup(filePath);
  await store.cleanup(filePath);

  expect(await readdir(dir)).toEqual([]);
});
