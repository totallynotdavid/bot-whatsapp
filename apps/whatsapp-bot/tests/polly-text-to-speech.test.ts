import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

// 0.2 s of a sine tone, so the test runs ffmpeg only for the conversion under
// test and not to make its input.
const MP3_BASE64 =
  "SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYzLjEuMTAyAAAAAAAAAAAAAAD/8yjEAAvAAs2/QRgCqQBkuH/4AAPg+D4PnwQg+D4IOOS4Pg+D/BB2D5//lA/wcOYgB/WDhzIA/wI7n+hpSgX//g0AT194/f3/8yjEDBAw5ogBm5AAMKLzhGYGGRxiiBRQ8cVAfIN4Q+EBxi3oAOodzECHOHOKP+RUipkXi9/6KJiIj31gqIj38FX///uRp2r/8yjEBg5IdjgB3hAAbkBcIwBQJgEDUYGwLphYDymnAMMb/pAxivi6GHMFeYSQkYXB1MC4AVH16n6tTIr////0qqV3l2l/QqD/8yjEBw1gajAAB7YsCAgBMwAwLjAWBvMFkW4yavKDVBHmMEYF0x0EOGszKzUFIyIrTorPDG///////qr///zjD9vawkQAQwD/8yjEDA7AciwA5/iAhswoOjHKHNKZ4w0FCUMb0CMjAzwLUzOazU0AMckQDE9Axp78S+kwD3////d/+2r///3G4bUUGgB0Ehj/8yjEDA2oajgBXgABAgDwkCKYJIOJhij2mmKD+cERBBiVBKGA0EIYSwlgiB+MDoApDRsbry84ff9Yiy4lIvlal5atpLggwIP/8yjEEBBwxpABm4AAlB8sIBmojGImEsn0ARQm4WAckcJHeOYWSJl8yNjFfzI0METcJEW5cGBCfV8mEC7f9yWEnjSNI6mZckH/8yjECQwwhdwBzzABRwqcQkJCcKKFuJc7TqeV0aVOnSytyHBJRIklsUXFBWApgKOxN6C/CUxBTUU0LjBVVVVVVVVVVVVVVVU=";

function mp3Bytes(): Buffer {
  return Buffer.from(MP3_BASE64, "base64");
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
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const { client } = pollyReturning(Buffer.alloc(0));
      const speech = new PollyTextToSpeech(REGION, tempFiles, client);

      const failure = speech
        .synthesize("hola", VOICE)
        .catch((error: Error) => error);
      await vi.runAllTimersAsync();
      expect(((await failure) as Error).message).toBe(
        "Polly returned no audio"
      );
    } finally {
      vi.useRealTimers();
    }
    expect(await readdir(dir)).toEqual([]);
  });
});
