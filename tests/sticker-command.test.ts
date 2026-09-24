import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { StickerCommand } from "../src/application/commands/sticker-command";
import { LIMITS } from "../src/config/constants";
import { runJob } from "../src/infrastructure/queue/job-runner";
import { stickerJob } from "../src/infrastructure/queue/jobs/sticker-job";
import { TempFileStore } from "../src/infrastructure/storage/temp-file-store";
import { WhatsAppSender } from "../src/infrastructure/whatsapp/sender";
import {
  FakeJobScheduler,
  FakeWhatsAppWebClient,
  OWNER_PHONE,
  REGULAR_PHONE,
  dm,
  inGroup,
  makeBot,
} from "./fixtures";

const GROUP_ID = "120363000000000001@g.us";
const MESSAGE_ID = "msg-fixed";
const QUOTED_ID = "msg-quoted";
const PNG = { sizeBytes: 1024, mimeType: "image/png" };

function setup() {
  const queue = new FakeJobScheduler();
  const bot = makeBot(({ sender }) => [
    new StickerCommand({ jobs: queue, sender }),
  ]);
  return { ...bot, queue };
}

describe("/sticker command", () => {
  test("media attached to the message schedules a sticker job for it", async () => {
    const { executor, sender, queue } = setup();
    sender.mediaInfos.set(MESSAGE_ID, PNG);

    const result = await executor.execute(
      dm(REGULAR_PHONE, "/sticker", { hasMedia: true })
    );

    expect(result?.type).toBe("queued");
    expect(queue.jobs).toEqual([
      {
        name: "sticker",
        payload: {
          messageId: MESSAGE_ID,
          chatId: `${REGULAR_PHONE}@c.us`,
          userId: REGULAR_PHONE,
          targetMessageId: MESSAGE_ID,
        },
      },
    ]);
  });

  test("a reply to a media message targets the quoted message, and the alias /s works", async () => {
    const { executor, sender, queue, groupRepo } = setup();
    sender.mediaInfos.set(QUOTED_ID, PNG);
    await groupRepo.registerOrReactivate(GROUP_ID, "Amigos", OWNER_PHONE);

    const result = await executor.execute(
      inGroup(REGULAR_PHONE, GROUP_ID, "/s", { quotedMessageId: QUOTED_ID })
    );

    expect(result?.type).toBe("queued");
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0]?.payload).toEqual({
      messageId: MESSAGE_ID,
      chatId: GROUP_ID,
      userId: REGULAR_PHONE,
      targetMessageId: QUOTED_ID,
    });
  });

  test("without media or a quoted message nothing is scheduled", async () => {
    const { executor, queue } = setup();

    const result = await executor.execute(dm(REGULAR_PHONE, "/sticker"));

    expect(result?.type).toBe("error");
    expect(queue.jobs).toEqual([]);
  });

  test("media whose info cannot be fetched is rejected", async () => {
    const { executor, queue } = setup();

    const result = await executor.execute(
      dm(REGULAR_PHONE, "/sticker", { hasMedia: true })
    );

    expect(result?.type).toBe("error");
    expect(queue.jobs).toEqual([]);
  });

  test("media over the size limit is rejected", async () => {
    const { executor, sender, queue } = setup();
    sender.mediaInfos.set(MESSAGE_ID, {
      sizeBytes: LIMITS.MEDIA_MAX_BYTES + 1,
      mimeType: "image/png",
    });

    const result = await executor.execute(
      dm(REGULAR_PHONE, "/sticker", { hasMedia: true })
    );

    expect(result?.type).toBe("error");
    expect(queue.jobs).toEqual([]);
  });

  test("media of a disallowed type is rejected", async () => {
    const { executor, sender, queue } = setup();
    sender.mediaInfos.set(MESSAGE_ID, {
      sizeBytes: 1024,
      mimeType: "application/pdf",
    });

    const result = await executor.execute(
      dm(REGULAR_PHONE, "/sticker", { hasMedia: true })
    );

    expect(result?.type).toBe("error");
    expect(queue.jobs).toEqual([]);
  });

  test("validating the media and making the sticker download it once in total", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sticker-command-test-"));
    try {
      const web = new FakeWhatsAppWebClient();
      web.media.set(MESSAGE_ID, {
        mimetype: "image/png",
        content: "png-bytes",
      });
      const sender = new WhatsAppSender(web.asClient());
      const queue = new FakeJobScheduler();
      const { executor } = makeBot(() => [
        new StickerCommand({ jobs: queue, sender }),
      ]);

      const result = await executor.execute(
        dm(REGULAR_PHONE, "/sticker", { hasMedia: true })
      );
      expect(result?.type).toBe("queued");

      const job = stickerJob({ sender, tempFiles: new TempFileStore(dir) });
      await runJob(job, queue.jobs[0]?.payload);

      expect(web.downloads).toBe(1);
      expect(web.events).toEqual([
        `sticker to ${REGULAR_PHONE}@c.us re ${MESSAGE_ID}: png-bytes`,
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("in an unregistered group the active-group gate stops it before any job is scheduled", async () => {
    const { executor, sender, queue } = setup();
    sender.mediaInfos.set(MESSAGE_ID, PNG);

    const result = await executor.execute(
      inGroup(REGULAR_PHONE, GROUP_ID, "/sticker", { hasMedia: true })
    );

    expect(result?.type).toBe("error");
    expect(queue.jobs).toEqual([]);
  });
});
