import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { CommandResult } from "../src/domain/command";
import { TempFileStore } from "../src/infrastructure/storage/temp-file-store";
import { ResponseBuilder } from "../src/presentation/response-builder";
import { FakeWhatsAppSender, REGULAR_PHONE, dm } from "./fixtures";

let dir: string;
let tempFiles: TempFileStore;
let sender: FakeWhatsAppSender;
let builder: ResponseBuilder;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "response-builder-test-"));
  tempFiles = new TempFileStore(dir);
  sender = new FakeWhatsAppSender();
  builder = new ResponseBuilder(sender, tempFiles);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function mediaResult(deleteAfterSend?: boolean): Promise<CommandResult> {
  const filePath = await tempFiles.saveBuffer(Buffer.from("png-bytes"), "png");
  return { type: "media", filePath, caption: "listo", deleteAfterSend };
}

describe("ResponseBuilder media replies", () => {
  test("a temp file is sent and then deleted", async () => {
    await builder.send(await mediaResult(true), dm(REGULAR_PHONE, "/edit"));

    expect(sender.sentMedia.map((media) => media.content)).toEqual([
      "png-bytes",
    ]);
    expect(await readdir(dir)).toEqual([]);
  });

  test("a temp file is deleted even when the send fails", async () => {
    sender.failMediaSends = true;

    await builder.send(await mediaResult(true), dm(REGULAR_PHONE, "/edit"));

    expect(sender.sentMedia).toHaveLength(1);
    expect(await readdir(dir)).toEqual([]);
  });

  test("a file the reply does not own is kept", async () => {
    const result = await mediaResult();

    await builder.send(result, dm(REGULAR_PHONE, "/edit"));

    expect(await readdir(dir)).toHaveLength(1);
  });
});
