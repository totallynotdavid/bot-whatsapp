import { beforeEach, describe, expect, test } from "vitest";
import { DocsCommand } from "../src/application/commands/docs-command";
import type { BookData, BookInfo } from "../src/domain/book";
import { MESSAGES } from "../src/i18n/es";
import {
  FakeAnnasArchiveClient,
  FakeJobScheduler,
  FakeRedis,
  REGULAR_PHONE,
  dm,
  inGroup,
  makeBot,
} from "./fixtures";

const GROUP_ID = "120363000000000001@g.us";

const DUNE: BookData = {
  title: "Dune",
  author: "Frank Herbert",
  link: "/md5/aaa",
  md5: "aaa",
  info: "English, epub, 2.5MB",
};
const NEUROMANCER: BookData = {
  title: "Neuromancer",
  link: "/md5/bbb",
  md5: "bbb",
};

function bookInfo(book: BookData, mirror?: string): BookInfo {
  return { ...book, format: "epub", mirror };
}

function setup() {
  const annas = new FakeAnnasArchiveClient();
  const redis = new FakeRedis();
  const queue = new FakeJobScheduler();
  const bot = makeBot(() => [
    new DocsCommand({
      books: annas,
      searchCache: redis.asCacheRepository(),
      jobs: queue,
    }),
  ]);
  return { ...bot, annas, queue };
}

describe("/docs command", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
    ctx.annas.results = [DUNE, NEUROMANCER];
    ctx.annas.bookInfos.set(
      DUNE.link,
      bookInfo(DUNE, "https://mirror.example/dune")
    );
    ctx.annas.bookInfos.set(NEUROMANCER.link, bookInfo(NEUROMANCER));
  });

  const search = (query = "ciencia ficcion") =>
    ctx.executor.execute(dm(REGULAR_PHONE, `/docs ${query}`));

  test("without an argument it explains the usage and touches nothing", async () => {
    const result = await ctx.executor.execute(dm(REGULAR_PHONE, "/docs"));

    expect(result?.type).toBe("error");
    expect(ctx.annas.searches).toEqual([]);
    expect(ctx.queue.jobs).toEqual([]);
  });

  test("a text query searches and lists the numbered results without scheduling a job", async () => {
    const result = await search();

    expect(ctx.annas.searches).toEqual(["ciencia ficcion"]);
    expect(result?.type).toBe("text");
    const content = (result as { content: string }).content;
    expect(content).toContain("1. Dune - Frank Herbert (2.5 MB)");
    expect(content).toContain("2. Neuromancer");
    expect(ctx.queue.jobs).toEqual([]);
  });

  test("a search with no hits says so", async () => {
    ctx.annas.results = [];

    const result = await search("zzzz");

    expect(result).toEqual({
      type: "text",
      content: 'No se encontraron resultados para "zzzz".',
    });
  });

  test("choosing a number after a search schedules a docs job for that book", async () => {
    await search();

    const result = await ctx.executor.execute(dm(REGULAR_PHONE, "/docs 1"));

    expect(result).toEqual({
      type: "queued",
      queueMessage: '📚 Descargando "Dune"...',
    });
    expect(ctx.annas.bookInfoRequests).toEqual([DUNE.link]);
    expect(ctx.queue.jobs).toEqual([
      {
        name: "docs",
        payload: {
          messageId: "msg-fixed",
          chatId: `${REGULAR_PHONE}@c.us`,
          userId: REGULAR_PHONE,
          mirror: "https://mirror.example/dune",
          format: "epub",
          title: "Dune",
          author: "Frank Herbert",
        },
      },
    ]);
  });

  test("a chosen number is consumed: repeating it needs a fresh search", async () => {
    await search();
    await ctx.executor.execute(dm(REGULAR_PHONE, "/docs 1"));

    const again = await ctx.executor.execute(dm(REGULAR_PHONE, "/docs 1"));

    expect(again?.type).toBe("error");
    expect(ctx.queue.jobs).toHaveLength(1);
  });

  test("a number without a prior search is rejected", async () => {
    const result = await ctx.executor.execute(dm(REGULAR_PHONE, "/docs 1"));

    expect(result?.type).toBe("error");
    expect(ctx.queue.jobs).toEqual([]);
  });

  test.each(["0", "3"])(
    "the out-of-range number %s is rejected and the search stays usable",
    async (number) => {
      await search();

      const result = await ctx.executor.execute(
        dm(REGULAR_PHONE, `/docs ${number}`)
      );

      expect(result?.type).toBe("error");
      expect(ctx.queue.jobs).toEqual([]);

      const valid = await ctx.executor.execute(dm(REGULAR_PHONE, "/docs 2"));
      expect(valid?.type).toBe("error");
      expect(ctx.annas.bookInfoRequests).toEqual([NEUROMANCER.link]);
    }
  );

  test("a book without a download mirror schedules nothing", async () => {
    await search();

    const result = await ctx.executor.execute(dm(REGULAR_PHONE, "/docs 2"));

    expect(result?.type).toBe("error");
    expect(ctx.queue.jobs).toEqual([]);
  });

  test("each user's search results are separate", async () => {
    await search();
    const other = "51977777777";

    const result = await ctx.executor.execute(dm(other, "/docs 1"));

    expect(result?.type).toBe("error");
    expect(ctx.queue.jobs).toEqual([]);
  });

  test("in an unregistered group the active-group gate stops it before any search", async () => {
    const result = await ctx.executor.execute(
      inGroup(REGULAR_PHONE, GROUP_ID, "/docs dune")
    );

    expect(result).toEqual({
      type: "error",
      userMessage: MESSAGES.errors.groupSubscriptionInactive,
    });
    expect(ctx.annas.searches).toEqual([]);
  });
});
