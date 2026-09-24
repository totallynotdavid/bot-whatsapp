import { mkdtemp, readdir, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UnrecoverableError } from "bullmq";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { JobPayload } from "../src/domain/job";
import type { AnyJobDefinition } from "../src/infrastructure/queue/job-definition";
import {
  isFinalFailure,
  reportFailure,
  runJob,
} from "../src/infrastructure/queue/job-runner";
import { stickerJob } from "../src/infrastructure/queue/jobs/sticker-job";
import { spotifyJob } from "../src/infrastructure/queue/jobs/spotify-job";
import { docsJob } from "../src/infrastructure/queue/jobs/docs-job";
import { TempFileStore } from "../src/infrastructure/storage/temp-file-store";
import { WhatsAppSender } from "../src/infrastructure/whatsapp/sender";
import type { TrackInfo } from "../src/application/ports/track-search";
import { TimeoutError } from "../src/lib/resilience/timeout";
import { FakeJobScheduler, FakeWhatsAppWebClient } from "./fixtures";

const CHAT_ID = "51922222222@c.us";
const MESSAGE_ID = "msg-1";
const TARGET_ID = "msg-media";

const STICKER: JobPayload<"sticker"> = {
  messageId: MESSAGE_ID,
  chatId: CHAT_ID,
  userId: "51922222222",
  targetMessageId: TARGET_ID,
};

const DOCS: JobPayload<"docs"> = {
  messageId: MESSAGE_ID,
  chatId: CHAT_ID,
  userId: "51922222222",
  mirror: "https://mirror.example/dune",
  format: "epub",
  title: "Dune",
};

// Drives attempts the way BullMQ 6's Worker does (Job.moveToFailed, then the
// "failed" event): attemptsMade is incremented before "failed" fires, and the
// job is retried while attemptsMade < attempts and the error is not an
// UnrecoverableError.
async function runLikeBullMQ(
  definition: AnyJobDefinition,
  data: unknown
): Promise<void> {
  const job = {
    id: "job-1",
    data,
    attemptsMade: 0,
    opts: { attempts: definition.limits.attempts },
  };
  for (;;) {
    client.events.push(`attempt ${job.attemptsMade + 1}`);
    try {
      await runJob(definition, job.data);
      client.events.push("completed");
      return;
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      job.attemptsMade += 1;
      await reportFailure(definition, job, error, sender);
      if (
        error instanceof UnrecoverableError ||
        job.attemptsMade >= job.opts.attempts
      ) {
        client.events.push("failed");
        return;
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeoutMs<N extends AnyJobDefinition>(
  definition: N,
  timeoutMs: number
): N {
  return { ...definition, limits: { ...definition.limits, timeoutMs } };
}

// Resolves after the job's timeout and records the signal it was given, so a
// test can check the signal was aborted and nothing ran after it.
function slowPort<T>(result: T) {
  const signals: (AbortSignal | undefined)[] = [];
  return {
    signals,
    call: async (_input: string, signal?: AbortSignal): Promise<T> => {
      signals.push(signal);
      await sleep(50);
      return result;
    },
  };
}

let tempDir: string;
let tempFiles: TempFileStore;
let client: FakeWhatsAppWebClient;
let sender: WhatsAppSender;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "job-pipeline-test-"));
  tempFiles = new TempFileStore(tempDir);
  client = new FakeWhatsAppWebClient();
  client.media.set(TARGET_ID, { mimetype: "image/png", content: "png-bytes" });
  sender = new WhatsAppSender(client.asClient());
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("job retries and failure reports", () => {
  test("a thrown error retries every attempt and reports to the user once, after the last", async () => {
    client.failDownloads = Infinity;

    await runLikeBullMQ(stickerJob({ sender, tempFiles }), STICKER);

    expect(client.events).toEqual([
      "attempt 1",
      "attempt 2",
      "attempt 3",
      `text to ${CHAT_ID} re ${MESSAGE_ID}: ❌ Error: Error al procesar el sticker`,
      "failed",
    ]);
    expect(client.downloads).toBe(3);
  });

  test("a job that fails and then succeeds delivers once and reports nothing", async () => {
    client.failDownloads = 2;

    await runLikeBullMQ(stickerJob({ sender, tempFiles }), STICKER);

    expect(client.events).toEqual([
      "attempt 1",
      "attempt 2",
      "attempt 3",
      `sticker to ${CHAT_ID} re ${MESSAGE_ID}: png-bytes`,
      "completed",
    ]);
  });

  test("a failed send is retried by the job, not inside the sender", async () => {
    client.failSends = 1;

    await runLikeBullMQ(stickerJob({ sender, tempFiles }), STICKER);

    expect(client.sendAttempts).toBe(2);
    expect(client.events).toEqual([
      "attempt 1",
      "attempt 2",
      `sticker to ${CHAT_ID} re ${MESSAGE_ID}: png-bytes`,
      "completed",
    ]);
  });

  test("a message without media is rejected once with its own message", async () => {
    client.media.clear();

    await runLikeBullMQ(stickerJob({ sender, tempFiles }), STICKER);

    expect(client.events).toEqual([
      "attempt 1",
      `text to ${CHAT_ID} re ${MESSAGE_ID}: ❌ Error: No se pudo obtener información del medio`,
      "failed",
    ]);
  });

  test("a song that is not found is not retried", async () => {
    let searches = 0;
    const spotify = {
      isConfigured: () => true,
      async searchTrack(): Promise<TrackInfo | null> {
        searches++;
        return null;
      },
    };

    await runLikeBullMQ(spotifyJob({ spotify, sender, tempFiles }), {
      ...STICKER,
      query: "nada",
    });

    expect(searches).toBe(1);
    expect(client.events).toEqual([
      "attempt 1",
      `text to ${CHAT_ID} re ${MESSAGE_ID}: ❌ Error: No se encontró la canción en Spotify`,
      "failed",
    ]);
  });

  test("a Spotify failure retries and ends with the job's failure message", async () => {
    let searches = 0;
    const spotify = {
      isConfigured: () => true,
      async searchTrack(): Promise<TrackInfo | null> {
        searches++;
        throw new Error("Spotify search failed: 503");
      },
    };

    await runLikeBullMQ(spotifyJob({ spotify, sender, tempFiles }), {
      ...STICKER,
      query: "monaco",
    });

    expect(searches).toBe(3);
    expect(client.events.at(-2)).toBe(
      `text to ${CHAT_ID} re ${MESSAGE_ID}: ❌ Error: No se pudo procesar la preview de Spotify`
    );
  });

  test("a Spotify job that meets missing credentials is rejected without searching or retrying", async () => {
    let searches = 0;
    const spotify = {
      isConfigured: () => false,
      async searchTrack(): Promise<TrackInfo | null> {
        searches++;
        return null;
      },
    };

    await runLikeBullMQ(spotifyJob({ spotify, sender, tempFiles }), {
      ...STICKER,
      query: "monaco",
    });

    expect(searches).toBe(0);
    expect(client.events).toEqual([
      "attempt 1",
      `text to ${CHAT_ID} re ${MESSAGE_ID}: ❌ Error: No se pudo procesar la preview de Spotify`,
      "failed",
    ]);
  });

  test("a book the mirror does not have is not retried", async () => {
    let downloads = 0;
    const annas = {
      async downloadBook(): Promise<Buffer | null> {
        downloads++;
        return null;
      },
    };

    await runLikeBullMQ(docsJob({ annas, sender, tempFiles }), DOCS);

    expect(downloads).toBe(1);
    expect(client.events).toEqual([
      "attempt 1",
      `text to ${CHAT_ID} re ${MESSAGE_ID}: ❌ Error: No se pudo descargar el documento`,
      "failed",
    ]);
  });

  test("a book download failure retries and ends with the job's failure message", async () => {
    let downloads = 0;
    const annas = {
      async downloadBook(): Promise<Buffer | null> {
        downloads++;
        throw new Error("Download failed: 502");
      },
    };

    await runLikeBullMQ(docsJob({ annas, sender, tempFiles }), DOCS);

    expect(downloads).toBe(3);
    expect(client.events.at(-2)).toBe(
      `text to ${CHAT_ID} re ${MESSAGE_ID}: ❌ Error: Error al descargar el documento`
    );
  });

  test("the final failure is detected from attemptsMade after BullMQ increments it", () => {
    const retryable = new Error("boom");
    const limits = { opts: { attempts: 3 }, data: STICKER };

    expect(isFinalFailure({ ...limits, attemptsMade: 2 }, retryable)).toBe(
      false
    );
    expect(isFinalFailure({ ...limits, attemptsMade: 3 }, retryable)).toBe(
      true
    );
    expect(
      isFinalFailure(
        { ...limits, attemptsMade: 1 },
        new UnrecoverableError("no")
      )
    ).toBe(true);
    expect(
      isFinalFailure(
        { ...limits, attemptsMade: 1 },
        new TimeoutError(10, "sticker job")
      )
    ).toBe(false);
  });
});

describe("payload validation", () => {
  test("an invalid payload is rejected as unrecoverable before the job runs", async () => {
    const definition = stickerJob({ sender, tempFiles });
    const { targetMessageId: _, ...withoutTarget } = STICKER;

    await expect(runJob(definition, withoutTarget)).rejects.toBeInstanceOf(
      UnrecoverableError
    );
    await runLikeBullMQ(definition, withoutTarget);

    expect(client.downloads).toBe(0);
    expect(client.events).toEqual([
      "attempt 1",
      `text to ${CHAT_ID} re ${MESSAGE_ID}: ❌ Error: Error al procesar el sticker`,
      "failed",
    ]);
  });

  test("a docs format that is not a bare extension is rejected", async () => {
    const annas = { downloadBook: async () => Buffer.from("book") };

    await expect(
      runJob(docsJob({ annas, sender, tempFiles }), {
        ...DOCS,
        format: "../../etc/passwd",
      })
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  test("enqueueing checks the payload against the job name at compile time", async () => {
    const scheduler = new FakeJobScheduler();

    // @ts-expect-error a spotify payload is not a sticker payload
    await scheduler.enqueue("sticker", { ...STICKER, query: "x" });
    await scheduler.enqueue("sticker", STICKER);

    expect(scheduler.jobs.map((job) => job.name)).toEqual([
      "sticker",
      "sticker",
    ]);
  });
});

describe("delivery", () => {
  test("a successful sticker job downloads the media once, delivers it and deletes the file", async () => {
    await runJob(stickerJob({ sender, tempFiles }), STICKER);

    expect(client.downloads).toBe(1);
    expect(client.events).toEqual([
      `sticker to ${CHAT_ID} re ${MESSAGE_ID}: png-bytes`,
    ]);
    expect(await readdir(tempDir)).toEqual([]);
  });

  test("a failed delivery still deletes the output file", async () => {
    client.failSends = 1;

    await expect(
      runJob(stickerJob({ sender, tempFiles }), STICKER)
    ).rejects.toThrow("simulated send failure");
    expect(await readdir(tempDir)).toEqual([]);
  });

  test("a docs job sends the book with its title and author as caption", async () => {
    const annas = { downloadBook: async () => Buffer.from("book-bytes") };

    await runJob(docsJob({ annas, sender, tempFiles }), {
      ...DOCS,
      author: "Frank Herbert",
    });

    expect(client.events).toEqual([
      `media to ${CHAT_ID} re ${MESSAGE_ID}: book-bytes caption=Dune por Frank Herbert voice=false`,
    ]);
    expect(await readdir(tempDir)).toEqual([]);
  });

  describe("spotify", () => {
    let server: Server;
    let previewUrl: string;

    beforeEach(async () => {
      server = createServer((_, response) => {
        response.writeHead(200, { "content-type": "audio/ogg" });
        response.end("ogg-bytes");
      });
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve)
      );
      const { port } = server.address() as AddressInfo;
      previewUrl = `http://127.0.0.1:${port}/preview.ogg`;
    });

    afterEach(async () => {
      await new Promise((resolve) => server.close(resolve));
    });

    test("sends the caption then the preview as a voice note, and deletes it", async () => {
      const spotify = {
        isConfigured: () => true,
        searchTrack: async (): Promise<TrackInfo> => ({
          name: "Monaco",
          artists: ["Bad Bunny"],
          albumName: "Nadie Sabe",
          previewUrl,
        }),
      };

      await runJob(spotifyJob({ spotify, sender, tempFiles }), {
        ...STICKER,
        query: "monaco",
      });

      expect(client.events).toEqual([
        `text to ${CHAT_ID} re ${MESSAGE_ID}: *Monaco* de Bad Bunny`,
        `media to ${CHAT_ID} re ${MESSAGE_ID}: ogg-bytes caption=undefined voice=true`,
      ]);
      expect(await readdir(tempDir)).toEqual([]);
    });
  });
});

describe("job timeout", () => {
  test("a hung sticker job throws a TimeoutError and stops at the download", async () => {
    client.downloadDelayMs = 50;

    await expect(
      runJob(withTimeoutMs(stickerJob({ sender, tempFiles }), 10), STICKER)
    ).rejects.toBeInstanceOf(TimeoutError);

    await sleep(100);
    expect(client.downloads).toBe(1);
    expect(client.events).toEqual([]);
    expect(await readdir(tempDir)).toEqual([]);
  });

  test("a timed-out Spotify job aborts the search and sends nothing", async () => {
    const search = slowPort<TrackInfo | null>({
      name: "Monaco",
      artists: ["Bad Bunny"],
      albumName: "Nadie Sabe",
      previewUrl: "http://127.0.0.1:1/never",
    });
    const spotify = { isConfigured: () => true, searchTrack: search.call };

    await expect(
      runJob(withTimeoutMs(spotifyJob({ spotify, sender, tempFiles }), 10), {
        ...STICKER,
        query: "monaco",
      })
    ).rejects.toBeInstanceOf(TimeoutError);

    await sleep(100);
    expect(search.signals.map((signal) => signal?.aborted)).toEqual([true]);
    expect(client.events).toEqual([]);
    expect(await readdir(tempDir)).toEqual([]);
  });

  test("a timed-out docs job aborts the download and sends nothing", async () => {
    const download = slowPort<Buffer | null>(Buffer.from("book-bytes"));
    const annas = { downloadBook: download.call };

    await expect(
      runJob(withTimeoutMs(docsJob({ annas, sender, tempFiles }), 10), DOCS)
    ).rejects.toBeInstanceOf(TimeoutError);

    await sleep(100);
    expect(download.signals.map((signal) => signal?.aborted)).toEqual([true]);
    expect(client.events).toEqual([]);
    expect(await readdir(tempDir)).toEqual([]);
  });
});
