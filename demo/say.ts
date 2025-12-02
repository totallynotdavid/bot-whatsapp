// Usage:
//   bun polly-demo.ts "Hola, esto es una prueba."
//   bun polly-demo.ts -Lupe "Este texto usará la voz Lupe"
//
// Requirements:
//   - AWS credentials configured (e.g. in ~/.aws/credentials)
//   - npm i @aws-sdk/client-polly

import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { writeFile } from "fs/promises";
import { Readable } from "stream";

const REGION = "us-east-1";
const polly = new PollyClient({ region: REGION });

// VoiceId -> Engine
const voiceOptions: Record<string, "standard" | "neural"> = {
  Ricardo: "standard",
  Conchita: "standard",
  Lucia: "neural",
  Enrique: "standard",
  Sergio: "neural",
  Mia: "neural",
  Andres: "neural",
  Lupe: "neural",
  Penelope: "standard",
  Miguel: "standard",
};

function getRandomVoice(): string {
  const voices = Object.keys(voiceOptions);
  return voices[Math.floor(Math.random() * voices.length)];
}

function isValidVoice(voiceId: string): boolean {
  return Object.prototype.hasOwnProperty.call(voiceOptions, voiceId);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(
      "Usage:\n" +
        '  bun polly-demo.ts "Your text here"\n' +
        '  bun polly-demo.ts -Lupe "Texto con voz Lupe"',
    );
    process.exit(1);
  }

  let voiceId = getRandomVoice();
  console.log(`Using voice: ${voiceId}`);
  let text: string;

  if (args[0].startsWith("-")) {
    const possibleVoice = args[0].slice(1);
    if (isValidVoice(possibleVoice)) {
      voiceId = possibleVoice;
    }
    text = args.slice(1).join(" ").trim();
  } else {
    text = args.join(" ").trim();
  }

  if (!text) {
    console.error("No text provided.");
    process.exit(1);
  }

  if (text.length > 1000) {
    console.error("Text too long. Limit is 1000 characters.");
    process.exit(1);
  }

  try {
    const audioBuffer = await synthesizeSpeech(text, voiceId);
    const filename = `tts-${voiceId}-${Date.now()}.mp3`;
    await writeFile(filename, audioBuffer);
    console.log(`Voice: ${voiceId}`);
    console.log(`Saved to: ${filename}`);
  } catch (err) {
    console.error("Failed to synthesize speech:", err);
    process.exit(1);
  }
}

async function synthesizeSpeech(
  text: string,
  voiceId: string,
): Promise<Buffer> {
  const engine = voiceOptions[voiceId] ?? "standard";

  const command = new SynthesizeSpeechCommand({
    Text: text,
    OutputFormat: "mp3",
    VoiceId: voiceId,
    Engine: engine,
  });

  const { AudioStream } = await polly.send(command);
  if (!AudioStream) {
    throw new Error("No audio stream returned by Polly.");
  }

  if (AudioStream instanceof Uint8Array) {
    return Buffer.from(AudioStream);
  }

  if (AudioStream instanceof Readable) {
    return streamToBuffer(AudioStream);
  }

  // Fallback for unknown types
  const chunks: Uint8Array[] = [];
  for await (const chunk of AudioStream as any) {
    chunks.push(
      typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk),
    );
  }
  return Buffer.concat(chunks);
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

main();
