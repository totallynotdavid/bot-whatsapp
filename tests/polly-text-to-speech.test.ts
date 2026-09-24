import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { PollyTextToSpeech } from "../src/infrastructure/speech/polly-text-to-speech";
import { TempFileStore } from "../src/infrastructure/storage/temp-file-store";
import { loadTestConfig } from "./fixtures";

loadTestConfig();

const VOICE = { name: "Lucia", engine: "neural" } as const;
const REGION = { region: "us-east-1" };

let dir: string;
let tempFiles: TempFileStore;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "polly-test-"));
  tempFiles = new TempFileStore(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function mp3Bytes(): Buffer {
  return execFileSync(
    "ffmpeg",
    [
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=duration=0.5",
      "-f",
      "mp3",
      "-",
    ],
    { maxBuffer: 1 << 20 }
  );
}

function pollyReturning(audio: Buffer) {
  const sent: unknown[] = [];
  const client = {
    send: async (command: { input: unknown }) => {
      sent.push(command.input);
      return { AudioStream: { transformToByteArray: async () => audio } };
    },
  };
  return { client: client as never, sent };
}

describe("PollyTextToSpeech", () => {
  test("without credentials it is not configured and refuses to synthesize", async () => {
    const speech = new PollyTextToSpeech(REGION, tempFiles);

    expect(speech.isConfigured()).toBe(false);
    await expect(speech.synthesize("hola", VOICE)).rejects.toThrow(
      "AWS credentials are not configured"
    );
  });

  test("it asks Polly for the voice and engine and returns a temp file of Ogg/Opus audio", async () => {
    const { client, sent } = pollyReturning(mp3Bytes());
    const speech = new PollyTextToSpeech(REGION, tempFiles, client);

    const filePath = await speech.synthesize("hola", VOICE);

    expect(sent).toEqual([
      { Text: "hola", VoiceId: "Lucia", Engine: "neural", OutputFormat: "mp3" },
    ]);
    expect(filePath.endsWith(".ogg")).toBe(true);
    const audio = await readFile(filePath);
    expect(audio.subarray(0, 4).toString()).toBe("OggS");
    expect(audio.includes("OpusHead")).toBe(true);
  });

  test("a Polly response without audio throws and leaves no file behind", async () => {
    const { client } = pollyReturning(Buffer.alloc(0));
    const speech = new PollyTextToSpeech(REGION, tempFiles, client);

    await expect(speech.synthesize("hola", VOICE)).rejects.toThrow(
      "Polly returned no audio"
    );
    expect(await readdir(dir)).toEqual([]);
  }, 15_000);
});
