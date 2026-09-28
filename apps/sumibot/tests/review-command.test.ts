import { existsSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { createReviewCommand } from "../src/application/commands/review-command";
import {
  GROUP_CHAT,
  LIBRARIAN_PHONE,
  makeMessage,
  makeWorld,
  type World,
} from "./fixtures";

function seedOpening(
  world: World,
  at: Date,
  url: string,
  phone = LIBRARIAN_PHONE
) {
  world.attendance.seed({
    action: "open",
    managerNumber: phone,
    imageUrl: url,
    timestamp: at,
  });
}

const run = (world: World) =>
  createReviewCommand(world.deps).run(makeMessage({ body: "!revisar" }));

describe("!revisar", () => {
  test("sends each of today's opening photos, in order, captioned with who and when", async () => {
    const world = makeWorld();
    world.attendance.librarians.set(LIBRARIAN_PHONE, "Ana Pérez");
    world.attendance.librarians.set("51922222222", "Luis Gómez");
    world.images.contents.set("https://files.example/a.jpg", "photo-a");
    world.images.contents.set("https://files.example/b.jpg", "photo-b");
    seedOpening(
      world,
      new Date(2025, 2, 10, 15, 30),
      "https://files.example/b.jpg",
      "51922222222"
    );
    seedOpening(
      world,
      new Date(2025, 2, 10, 8, 5),
      "https://files.example/a.jpg"
    );

    await run(world);

    expect(
      world.transport.media.map(({ chatId, caption, content }) => ({
        chatId,
        caption,
        content,
      }))
    ).toEqual([
      { chatId: GROUP_CHAT, caption: "Ana Pérez: 8:05 AM", content: "photo-a" },
      {
        chatId: GROUP_CHAT,
        caption: "Luis Gómez: 3:30 PM",
        content: "photo-b",
      },
    ]);
    expect(world.transport.texts).toEqual([]);
  });

  test("deletes each downloaded photo once it is sent", async () => {
    const world = makeWorld();
    world.images.contents.set("https://files.example/a.jpg", "photo-a");
    seedOpening(world, new Date(2025, 2, 10, 8), "https://files.example/a.jpg");

    await run(world);

    expect(world.images.disposed).toHaveLength(1);
    expect(existsSync(world.images.disposed[0]!)).toBe(false);
  });

  test("leaves out openings from other days and closings", async () => {
    const world = makeWorld();
    world.images.contents.set("https://files.example/today.jpg", "today");
    world.images.contents.set("https://files.example/old.jpg", "old");
    seedOpening(
      world,
      new Date(2025, 2, 9, 23, 59),
      "https://files.example/old.jpg"
    );
    seedOpening(
      world,
      new Date(2025, 2, 11, 0, 0),
      "https://files.example/old.jpg"
    );
    seedOpening(
      world,
      new Date(2025, 2, 10, 0, 0),
      "https://files.example/today.jpg"
    );
    world.attendance.seed({
      action: "close",
      managerNumber: LIBRARIAN_PHONE,
      imageUrl: "https://files.example/old.jpg",
      timestamp: new Date(2025, 2, 10, 18),
    });

    await run(world);

    expect(world.transport.media.map((sent) => sent.content)).toEqual([
      "today",
    ]);
  });

  test("says nobody opened the library when there are no openings today", async () => {
    const world = makeWorld();

    await run(world);

    expect(world.transport.texts).toEqual([
      { chatId: GROUP_CHAT, text: "Hoy nadie abrió la biblioteca." },
    ]);
    expect(world.transport.media).toEqual([]);
  });

  test("captions with the number when the opener is not a known librarian", async () => {
    const world = makeWorld();
    world.images.contents.set("https://files.example/a.jpg", "photo-a");
    seedOpening(
      world,
      new Date(2025, 2, 10, 8, 5),
      "https://files.example/a.jpg"
    );

    await run(world);

    expect(world.transport.media[0]?.caption).toBe(
      `${LIBRARIAN_PHONE}: 8:05 AM`
    );
  });

  test("replies with an error when the read fails", async () => {
    const world = makeWorld();
    world.attendance.failReads = true;

    await run(world);

    expect(world.transport.texts).toEqual([
      { chatId: GROUP_CHAT, text: "Hubo un error al obtener las imágenes." },
    ]);
  });

  test("replies with an error when a photo cannot be downloaded", async () => {
    const world = makeWorld();
    seedOpening(
      world,
      new Date(2025, 2, 10, 8),
      "https://files.example/missing.jpg"
    );

    await run(world);

    expect(world.transport.texts.map((sent) => sent.text)).toEqual([
      "Hubo un error al obtener las imágenes.",
    ]);
  });

  test("deletes the photo and replies with an error when sending it fails", async () => {
    const world = makeWorld();
    world.images.contents.set("https://files.example/a.jpg", "photo-a");
    seedOpening(world, new Date(2025, 2, 10, 8), "https://files.example/a.jpg");
    world.transport.failNextSends(1);

    await run(world);

    expect(world.images.disposed).toHaveLength(1);
    expect(world.transport.texts.map((sent) => sent.text)).toEqual([
      "Hubo un error al obtener las imágenes.",
    ]);
  });
});
