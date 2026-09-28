import { describe, expect, test } from "vitest";
import { createAttendanceCommand } from "../src/application/commands/attendance-command";
import {
  GROUP_CHAT,
  makeMessage,
  makePhotoMessage,
  makeWorld,
} from "./fixtures";

describe.each([
  {
    action: "open",
    name: "abierto",
    confirmation: "¡La biblioteca se ha abierto! Gracias por tu colaboración.",
  },
  {
    action: "close",
    name: "cerrado",
    confirmation: "¡La biblioteca se ha cerrado! Gracias por tu colaboración.",
  },
] as const)("!$name", ({ action, name, confirmation }) => {
  test("is named after the action", () => {
    expect(createAttendanceCommand(action, makeWorld().deps).name).toBe(name);
  });

  test("stores the photo, records who did it and when, and confirms", async () => {
    const world = makeWorld();
    world.transport.attachMedia("msg-1", "jpeg-bytes");
    const message = makePhotoMessage(`!${name}`);

    const outcome = await createAttendanceCommand(action, world.deps).run(
      message
    );

    expect(outcome).toBe("completed");
    expect(world.photos.uploads).toEqual([
      { managerNumber: message.senderId, content: "jpeg-bytes" },
    ]);
    expect(world.attendance.records).toEqual([
      {
        action,
        managerNumber: message.senderId,
        imageUrl: `https://files.example/${message.senderId}/1.jpg`,
        timestamp: world.clock,
      },
    ]);
    expect(world.transport.texts).toEqual([
      { chatId: GROUP_CHAT, text: confirmation },
    ]);
  });

  test("asks for a photo when the message has none, and records nothing", async () => {
    const world = makeWorld();

    const outcome = await createAttendanceCommand(action, world.deps).run(
      makeMessage({ body: `!${name}` })
    );

    expect(outcome).toBe("failed");
    expect(world.transport.texts).toEqual([
      {
        chatId: GROUP_CHAT,
        text: "Por favor envía una foto de la biblioteca para confirmar tu ingreso/salida.",
      },
    ]);
    expect(world.photos.uploads).toEqual([]);
    expect(world.attendance.records).toEqual([]);
  });

  test("asks for a photo when the attachment is a video", async () => {
    const world = makeWorld();

    await createAttendanceCommand(action, world.deps).run(
      makeMessage({ body: `!${name}`, hasMedia: true, mediaType: "video" })
    );

    expect(world.transport.texts[0]?.text).toContain("envía una foto");
    expect(world.attendance.records).toEqual([]);
  });

  test("reports a problem and records nothing when the photo cannot be downloaded", async () => {
    const world = makeWorld();

    const outcome = await createAttendanceCommand(action, world.deps).run(
      makePhotoMessage(`!${name}`)
    );

    expect(outcome).toBe("failed");
    expect(world.transport.texts).toEqual([
      { chatId: GROUP_CHAT, text: "Houston, tenemos un problema." },
    ]);
    expect(world.attendance.records).toEqual([]);
    expect(world.logs.at(-1)).toMatchObject({
      level: "error",
      message: "Could not register attendance",
    });
  });

  test("reports a problem and records nothing when the upload fails", async () => {
    const world = makeWorld();
    world.transport.attachMedia("msg-1", "jpeg-bytes");
    world.photos.fail = true;

    const outcome = await createAttendanceCommand(action, world.deps).run(
      makePhotoMessage(`!${name}`)
    );

    expect(outcome).toBe("failed");
    expect(world.transport.texts[0]?.text).toBe(
      "Houston, tenemos un problema."
    );
    expect(world.attendance.records).toEqual([]);
  });
});
