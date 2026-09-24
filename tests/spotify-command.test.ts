import { describe, expect, test } from "vitest";
import { SpotifyCommand } from "../src/application/commands/spotify-command";
import { MESSAGES } from "../src/i18n/es";
import {
  FakeJobScheduler,
  REGULAR_PHONE,
  dm,
  inGroup,
  makeBot,
} from "./fixtures";

const GROUP_ID = "120363000000000001@g.us";

function setup({ configured = true } = {}) {
  const queue = new FakeJobScheduler();
  const tracks = {
    isConfigured: () => configured,
    searchTrack: async () => null,
  };
  const bot = makeBot(() => [new SpotifyCommand({ jobs: queue, tracks })]);
  return { ...bot, queue };
}

describe("/spot command", () => {
  test("without Spotify credentials it replies at once and enqueues nothing", async () => {
    const { executor, queue } = setup({ configured: false });

    const result = await executor.execute(
      dm(REGULAR_PHONE, "/spot Bad Bunny Monaco")
    );

    expect(result).toEqual({
      type: "error",
      userMessage: "El comando /spot no está disponible en este momento.",
    });
    expect(queue.jobs).toEqual([]);
  });

  test("without arguments it shows usage even when Spotify is not configured", async () => {
    const { executor, queue } = setup({ configured: false });

    const result = await executor.execute(dm(REGULAR_PHONE, "/spot"));

    expect(result).toEqual({
      type: "text",
      content: "Uso: /spot <artista|cancion>",
    });
    expect(queue.jobs).toEqual([]);
  });

  test("schedules a spotify job carrying the whole query", async () => {
    const { executor, queue } = setup();

    const result = await executor.execute(
      dm(REGULAR_PHONE, "/spot Bad Bunny  Monaco")
    );

    expect(result?.type).toBe("queued");
    expect(queue.jobs).toEqual([
      {
        name: "spotify",
        payload: {
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
      expect(queue.jobs.map((job) => job.name)).toEqual(["spotify"]);
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
