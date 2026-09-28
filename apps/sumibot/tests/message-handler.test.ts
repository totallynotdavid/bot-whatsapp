import { describe, expect, test } from "vitest";
import { createCommands } from "../src/application/commands";
import { MessageHandler } from "../src/application/handlers/message-handler";
import { start } from "../src/bootstrap/lifecycle";
import type { Command } from "../src/domain/command";
import {
  GROUP_CHAT,
  LIBRARIAN_PHONE,
  OWNER_PHONE,
  makeMessage,
  makePhotoMessage,
  makeWorld,
  type World,
} from "./fixtures";

// The handler is wired the way main does: registered on the transport by
// start(), then fed messages the way an adapter delivers them.
async function startBot(world: World, prefix = "!") {
  const handler = new MessageHandler(
    createCommands(world.deps),
    world.transport,
    world.events,
    prefix,
    world.deps.log,
    world.deps.now
  );
  await start(
    {
      transport: world.transport,
      sender: world.transport,
      handler,
      notifyServer: { start: () => 6000 },
      ownerPhone: OWNER_PHONE,
    },
    world.deps.log
  );
  world.transport.texts.length = 0;
  return handler;
}

describe("message handler", () => {
  test("runs the command, logs its use and reacts with a check mark", async () => {
    const world = makeWorld();
    await startBot(world);

    await world.transport.deliver(makeMessage({ body: "!estado" }));

    expect(world.transport.texts).toEqual([
      { chatId: GROUP_CHAT, text: "La biblioteca está cerrada." },
    ]);
    expect(world.events.usages).toEqual([
      {
        commandId: "!estado",
        commandName: "estado",
        message: expect.objectContaining({
          senderId: LIBRARIAN_PHONE,
          body: "!estado",
        }),
        at: world.clock,
      },
    ]);
    expect(world.transport.reactions).toEqual([
      { messageId: "msg-1", emoji: "✅" },
    ]);
  });

  test("handles a command sent as a photo caption", async () => {
    const world = makeWorld();
    world.transport.attachMedia("msg-1", "jpeg-bytes");
    await startBot(world);

    await world.transport.deliver(makePhotoMessage("!abierto"));

    expect(world.attendance.records).toHaveLength(1);
    expect(world.transport.texts[0]?.text).toContain("se ha abierto");
  });

  test("matches the command name ignoring case and reads trailing text as arguments", async () => {
    const world = makeWorld();
    await startBot(world);

    await world.transport.deliver(makeMessage({ body: "  !ESTADO por favor" }));

    expect(world.transport.texts).toHaveLength(1);
  });

  test("treats a command followed by a line break as that command", async () => {
    const world = makeWorld();
    await startBot(world);

    await world.transport.deliver(makeMessage({ body: "!estado\nhola" }));

    expect(world.transport.texts[0]?.text).toBe("La biblioteca está cerrada.");
  });

  test("ignores messages that are not commands", async () => {
    const world = makeWorld();
    const handler = await startBot(world);

    await world.transport.deliver(makeMessage({ body: "buenos días" }));
    await handler.handle(makeMessage({ body: "estado !" }));
    await handler.handle(makeMessage({ body: "!" }));

    expect(world.transport.texts).toEqual([]);
    expect(world.events.usages).toEqual([]);
    expect(world.events.failures).toEqual([]);
    expect(world.transport.reactions).toEqual([]);
  });

  test("ignores commands sent in a private chat", async () => {
    const world = makeWorld();
    const handler = await startBot(world);

    await handler.handle(
      makeMessage({
        body: "!estado",
        isGroup: false,
        chatId: `${LIBRARIAN_PHONE}@s.whatsapp.net`,
      })
    );

    expect(world.transport.texts).toEqual([]);
    expect(world.events.usages).toEqual([]);
  });

  test("only reacts to the configured prefix", async () => {
    const world = makeWorld();
    const handler = await startBot(world, "#");

    await handler.handle(makeMessage({ body: "!estado" }));
    expect(world.transport.texts).toEqual([]);

    await world.transport.deliver(makeMessage({ body: "#estado" }));
    expect(world.transport.texts).toHaveLength(1);
    expect(world.events.usages[0]?.commandId).toBe("#estado");
  });

  test("logs an unknown command as an error, without replying or reacting", async () => {
    const world = makeWorld();
    await startBot(world);

    await world.transport.deliver(makeMessage({ body: "!traducir hola" }));

    expect(world.events.failures).toHaveLength(1);
    expect(world.events.failures[0]?.error).toEqual(
      new Error("Unrecognized command: traducir")
    );
    expect(world.events.failures[0]?.message.senderId).toBe(LIBRARIAN_PHONE);
    expect(world.transport.texts).toEqual([]);
    expect(world.transport.reactions).toEqual([]);
    expect(world.events.usages).toEqual([]);
  });

  test("answers everyone in the group alike: no command needs a rank", async () => {
    const world = makeWorld();
    await startBot(world);

    for (const senderId of [OWNER_PHONE, "51955555555"]) {
      await world.transport.deliver(makeMessage({ body: "!estado", senderId }));
    }

    expect(world.transport.texts).toHaveLength(2);
  });

  test("logs a command that fails and does not react", async () => {
    const world = makeWorld();
    const broken: Command = {
      name: "roto",
      run: async () => {
        throw new Error("boom");
      },
    };
    const handler = new MessageHandler(
      [broken],
      world.transport,
      world.events,
      "!",
      world.deps.log,
      world.deps.now
    );

    await expect(
      handler.handle(makeMessage({ body: "!roto" }))
    ).resolves.toBeUndefined();

    expect(world.events.failures).toEqual([
      expect.objectContaining({ error: new Error("boom") }),
    ]);
    expect(world.transport.reactions).toEqual([]);
    expect(world.logs[0]).toMatchObject({
      level: "error",
      message: "Message processing failed",
    });
  });

  test("still replies and reacts when the event log is down", async () => {
    const world = makeWorld();
    world.events.failWrites = true;
    await startBot(world);

    await world.transport.deliver(makeMessage({ body: "!estado" }));

    expect(world.transport.texts).toHaveLength(1);
    expect(world.transport.reactions).toHaveLength(1);
    expect(world.logs.at(-1)).toMatchObject({
      level: "warn",
      message: "Could not write to the event log",
    });
  });

  test("does not reject when the event log is down for an unknown command", async () => {
    const world = makeWorld();
    world.events.failWrites = true;
    const handler = await startBot(world);

    await expect(
      handler.handle(makeMessage({ body: "!nada" }))
    ).resolves.toBeUndefined();
  });

  test.each([
    ["a photo is missing", () => {}, () => makeMessage({ body: "!abierto" })],
    [
      "the record cannot be written",
      (world: World) => {
        world.attendance.failRecords = true;
        world.transport.attachMedia("msg-1", "jpeg-bytes");
      },
      () => makePhotoMessage("!cerrado"),
    ],
    [
      "the photo cannot be downloaded",
      () => {},
      () => makePhotoMessage("!abierto"),
    ],
    [
      "the status cannot be read",
      (world: World) => {
        world.attendance.failReads = true;
      },
      () => makeMessage({ body: "!estado" }),
    ],
    [
      "the openings cannot be read",
      (world: World) => {
        world.attendance.failReads = true;
      },
      () => makeMessage({ body: "!revisar" }),
    ],
  ])("replies but does not react when %s", async (_name, arrange, message) => {
    const world = makeWorld();
    arrange(world);
    await startBot(world);

    await world.transport.deliver(message());

    expect(world.transport.texts).toHaveLength(1);
    expect(world.transport.reactions).toEqual([]);
    expect(world.events.usages).toHaveLength(1);
    expect(world.events.failures).toEqual([]);
  });

  test("reacts when a command answers despite a failed side lookup", async () => {
    const world = makeWorld();
    world.attendance.seed({
      action: "open",
      managerNumber: LIBRARIAN_PHONE,
      imageUrl: "https://files.example/a.jpg",
      timestamp: new Date(2025, 2, 10, 8),
    });
    world.attendance.failLibrarianLookups = true;
    await startBot(world);

    await world.transport.deliver(makeMessage({ body: "!estado" }));

    expect(world.transport.texts).toHaveLength(1);
    expect(world.transport.reactions).toHaveLength(1);
  });

  test("a reply the transport drops is not sent again, and the command is logged as failed", async () => {
    const world = makeWorld();
    world.transport.attachMedia("msg-1", "jpeg-bytes");
    await startBot(world);
    world.transport.failNextSends(1);

    await world.transport.deliver(makePhotoMessage("!abierto"));

    expect(world.attendance.records).toHaveLength(1);
    expect(world.transport.texts).toEqual([]);
    expect(world.transport.reactions).toEqual([]);
    expect(world.events.failures).toEqual([
      expect.objectContaining({ error: new Error("connection closed") }),
    ]);
  });

  test("rejects two commands with the same name", () => {
    const world = makeWorld();
    const [first] = createCommands(world.deps);

    expect(
      () =>
        new MessageHandler(
          [first!, first!],
          world.transport,
          world.events,
          "!",
          world.deps.log,
          world.deps.now
        )
    ).toThrow("Command already registered: abierto");
  });

  test("the transport filter accepts exactly the messages that parse as commands", async () => {
    const world = makeWorld();
    const handler = await startBot(world);

    expect(handler.isCommand("!estado")).toBe(true);
    expect(handler.isCommand("  !estado")).toBe(true);
    expect(handler.isCommand("estado")).toBe(false);
    expect(handler.isCommand("!")).toBe(false);
    expect(handler.isCommand("")).toBe(false);
  });
});
