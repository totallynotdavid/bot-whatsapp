import { describe, expect, test } from "vitest";
import { createStatusCommand } from "../src/application/commands/status-command";
import type { AttendanceAction } from "../src/domain/attendance";
import {
  GROUP_CHAT,
  LIBRARIAN_PHONE,
  makeMessage,
  makeWorld,
  type World,
} from "./fixtures";

function seed(world: World, action: AttendanceAction, hour: number) {
  world.attendance.seed({
    action,
    managerNumber: LIBRARIAN_PHONE,
    imageUrl: "https://files.example/x.jpg",
    timestamp: new Date(2025, 2, 10, hour),
  });
}

async function statusReply(
  world: World,
  expectedOutcome = "completed"
): Promise<string | undefined> {
  const outcome = await createStatusCommand(world.deps).run(
    makeMessage({ body: "!estado" })
  );
  expect(outcome).toBe(expectedOutcome);
  expect(
    world.transport.texts.every((sent) => sent.chatId === GROUP_CHAT)
  ).toBe(true);
  return world.transport.texts.at(-1)?.text;
}

describe("!estado", () => {
  test("is closed when nobody has opened it", async () => {
    expect(await statusReply(makeWorld())).toBe("La biblioteca está cerrada.");
  });

  test("is open, and says who opened it, after an opening", async () => {
    const world = makeWorld();
    world.attendance.librarians.set(LIBRARIAN_PHONE, "Ana Pérez");
    seed(world, "open", 8);

    expect(await statusReply(world)).toBe(
      "La biblioteca está abierta. Abierto por: Ana Pérez."
    );
  });

  test("is open when the closing is older than the opening", async () => {
    const world = makeWorld();
    world.attendance.librarians.set(LIBRARIAN_PHONE, "Ana Pérez");
    seed(world, "close", 7);
    seed(world, "open", 8);

    expect(await statusReply(world)).toContain("abierta");
  });

  test("is closed when the closing is newer than the opening", async () => {
    const world = makeWorld();
    seed(world, "open", 8);
    seed(world, "close", 9);

    expect(await statusReply(world)).toBe("La biblioteca está cerrada.");
  });

  test("is closed when the opening and closing share a timestamp", async () => {
    const world = makeWorld();
    seed(world, "open", 8);
    seed(world, "close", 8);

    expect(await statusReply(world)).toBe("La biblioteca está cerrada.");
  });

  test("is open without a name when the opener is not a known librarian", async () => {
    const world = makeWorld();
    seed(world, "open", 8);

    expect(await statusReply(world)).toBe("La biblioteca está abierta.");
  });

  test("still says it is open when the librarian lookup fails", async () => {
    const world = makeWorld();
    seed(world, "open", 8);
    world.attendance.failLibrarianLookups = true;

    expect(await statusReply(world)).toBe("La biblioteca está abierta.");
    expect(world.logs.map((entry) => entry.level)).toEqual(["warn"]);
  });

  test("reports an error, without the database detail, when the read fails", async () => {
    const world = makeWorld();
    world.attendance.failReads = true;

    expect(await statusReply(world, "failed")).toBe(
      "Error al obtener el estado de la biblioteca"
    );
    expect(world.logs[0]).toMatchObject({
      level: "error",
      metadata: { error: "database down" },
    });
  });
});
