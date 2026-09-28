import { PassThrough, Readable } from "node:stream";
import {
  PollyClient,
  SynthesizeSpeechCommand,
  type VoiceId,
} from "@aws-sdk/client-polly";
import ffmpeg from "fluent-ffmpeg";
import type { TempStore } from "../../application/ports/temp-store";
import type { TextToSpeech } from "../../application/ports/text-to-speech";
import type { Voice } from "../../domain/voice";
import { TIMEOUTS } from "../../config/constants";
import { retry } from "../../lib/resilience/retry";
import { withTimeout } from "../../lib/resilience/timeout";

export interface PollyCredentials {
  readonly accessKeyId?: string;
  readonly secretAccessKey?: string;
  readonly region: string;
}

type PollySender = Pick<PollyClient, "send">;

export class PollyTextToSpeech implements TextToSpeech {
  private readonly client?: PollySender;

  constructor(
    credentials: PollyCredentials,
    private readonly tempFiles: Pick<TempStore, "saveBuffer">,
    client?: PollySender
  ) {
    const { accessKeyId, secretAccessKey, region } = credentials;
    if (client) {
      this.client = client;
    } else if (accessKeyId && secretAccessKey) {
      // The retry below is the only retry layer.
      this.client = new PollyClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
        maxAttempts: 1,
      });
    }
  }

  isConfigured(): boolean {
    return this.client !== undefined;
  }

  async synthesize(
    text: string,
    voice: Voice,
    signal?: AbortSignal
  ): Promise<string> {
    const client = this.client;
    if (!client) throw new Error("AWS credentials are not configured");

    const mp3 = await retry(
      () =>
        withTimeout(
          async (callSignal) => {
            const response = await client.send(
              new SynthesizeSpeechCommand({
                Text: text,
                VoiceId: voice.name as VoiceId,
                Engine: voice.engine,
                OutputFormat: "mp3",
              }),
              { abortSignal: callSignal }
            );
            const audio = await response.AudioStream?.transformToByteArray();
            if (!audio?.length) throw new Error("Polly returned no audio");
            return Buffer.from(audio);
          },
          TIMEOUTS.EXTERNAL_API_MS,
          "polly-synthesize",
          signal
        ),
      "polly-synthesize"
    );

    return this.tempFiles.saveBuffer(await toOggOpus(mp3), "ogg");
  }
}

function toOggOpus(mp3: Buffer): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const output = new PassThrough();
    output.on("data", (chunk: Buffer) => chunks.push(chunk));
    output.on("end", () => resolve(Buffer.concat(chunks)));
    ffmpeg(Readable.from([mp3]))
      .audioCodec("libopus")
      .audioBitrate("64k")
      .format("ogg")
      .on("error", reject)
      .pipe(output, { end: true });
  });
}
