import { describe, expect, test } from "vitest";
import { SpotifyCommand } from "../src/application/commands/spotify-command";
import { QUEUE_PRIORITY } from "../src/config/constants";
import { MESSAGES } from "../src/i18n/es";
import { FakeQueue, REGULAR_PHONE, dm, inGroup, makeBot } from "./fixtures";

const GROUP_ID = "120363000000000001@g.us";

function setup() {
  const queue = new FakeQueue();
  const bot = makeBot(() => [new SpotifyCommand(queue.asJobScheduler())]);
  return { ...bot, queue };
}

describe("/spot command", () => {
  test("schedules a normal-priority spotify job carrying the whole query", async () => {
    const { executor, queue } = setup();

    const result = await executor.execute(
      dm(REGULAR_PHONE, "/spot Bad Bunny  Monaco")
    );

    expect(result?.type).toBe("queued");
    expect(queue.jobs).toEqual([
      {
        type: "spotify",
        priority: QUEUE_PRIORITY.NORMAL,
        data: {
          messageId: "msg-fixed",
          chatId: `${REGULAR_PHONE}@c.us`,
          userId: REGULAR_PHONE,
          query: "Bad Bunny Monaco",
        },
      },
    ]);
  });

  test.each(["spotify", "spt"])(
    "the /%s alias schedules the same job",
    async (alias) => {
      const { executor, queue } = setup();

      const result = await executor.execute(
        dm(REGULAR_PHONE, `/${alias} Karol G`)
      );

      expect(result?.type).toBe("queued");
      expect(queue.jobs.map((job) => job.type)).toEqual(["spotify"]);
    }
  );

  test("without a query it shows the usage and schedules nothing", async () => {
    const { executor, queue } = setup();

    const result = await executor.execute(dm(REGULAR_PHONE, "/spot"));

    expect(result).toEqual({
      type: "text",
      content: "Uso: /spot <artista|cancion>",
    });
    expect(queue.jobs).toEqual([]);
  });

  test("in an unregistered group the active-group gate stops it before any job is scheduled", async () => {
    const { executor, queue } = setup();

    const result = await executor.execute(
      inGroup(REGULAR_PHONE, GROUP_ID, "/spot Karol G")
    );

    expect(result).toEqual({
      type: "error",
      userMessage: MESSAGES.errors.groupSubscriptionInactive,
    });
    expect(queue.jobs).toEqual([]);
  });
});
