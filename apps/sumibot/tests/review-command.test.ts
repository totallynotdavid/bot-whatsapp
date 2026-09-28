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

    expect(await run(world)).toBe("completed");

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

    expect(await run(world)).toBe("failed");

    expect(world.transport.texts).toEqual([
      { chatId: GROUP_CHAT, text: "Hubo un error al obtener las imágenes." },
    ]);
  });

  test("sends the other photos and names the one that cannot be downloaded", async () => {
    const world = makeWorld();
    world.attendance.librarians.set(LIBRARIAN_PHONE, "Ana Pérez");
    world.images.contents.set("https://files.example/a.jpg", "photo-a");
    world.images.contents.set("https://files.example/c.jpg", "photo-c");
    seedOpening(world, new Date(2025, 2, 10, 8), "https://files.example/a.jpg");
    seedOpening(
      world,
      new Date(2025, 2, 10, 9, 30),
      "https://files.example/missing.jpg"
    );
    seedOpening(
      world,
      new Date(2025, 2, 10, 11),
      "https://files.example/c.jpg"
    );

    const outcome = await run(world);

    expect(outcome).toBe("failed");
    expect(world.transport.media.map((sent) => sent.content)).toEqual([
      "photo-a",
      "photo-c",
    ]);
    expect(world.transport.texts).toEqual([
      {
        chatId: GROUP_CHAT,
        text: "No se pudieron enviar estas fotos:\n- Ana Pérez: 9:30 AM",
      },
    ]);
    expect(world.logs).toContainEqual({
      level: "error",
      message: "Could not send an opening photo",
      metadata: {
        imageUrl: "https://files.example/missing.jpg",
        error: "no image at https://files.example/missing.jpg",
      },
    });
  });

  test("keeps going and names every photo that cannot be sent, deleting each download", async () => {
    const world = makeWorld();
    world.images.contents.set("https://files.example/a.jpg", "photo-a");
    world.images.contents.set("https://files.example/b.jpg", "photo-b");
    seedOpening(world, new Date(2025, 2, 10, 8), "https://files.example/a.jpg");
    seedOpening(world, new Date(2025, 2, 10, 9), "https://files.example/b.jpg");
    world.transport.failNextSends(1);

    const outcome = await run(world);

    expect(outcome).toBe("failed");
    expect(world.transport.media.map((sent) => sent.content)).toEqual([
      "photo-b",
    ]);
    expect(world.images.disposed).toHaveLength(2);
    expect(world.transport.texts.map((sent) => sent.text)).toEqual([
      `No se pudieron enviar estas fotos:\n- ${LIBRARIAN_PHONE}: 8:00 AM`,
    ]);
  });

  test("still captions a photo when the librarian lookup fails", async () => {
    const world = makeWorld();
    world.images.contents.set("https://files.example/a.jpg", "photo-a");
    seedOpening(world, new Date(2025, 2, 10, 8), "https://files.example/a.jpg");
    world.attendance.failLibrarianLookups = true;

    const outcome = await run(world);

    expect(outcome).toBe("completed");
    expect(world.transport.media[0]?.caption).toBe(
      `${LIBRARIAN_PHONE}: 8:00 AM`
    );
  });
});
