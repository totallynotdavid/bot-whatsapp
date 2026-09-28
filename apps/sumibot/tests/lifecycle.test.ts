import { describe, expect, test } from "vitest";
import { start, stop } from "../src/bootstrap/lifecycle";
import { FakeTransport, OWNER_PHONE, recordingLogger } from "./fixtures";

function makeTargets() {
  const transport = new FakeTransport();
  const order = transport.events;
  const targets = {
    transport,
    sender: transport,
    handler: { handle: async () => {}, isCommand: () => true },
    notifyServer: {
      start: () => {
        order.push("server start");
        return 6000;
      },
      stop: async () => {
        order.push("server stop");
      },
    },
    ownerPhone: OWNER_PHONE,
  };
  return { transport, targets, ...recordingLogger() };
}

describe("start", () => {
  test("listens before it connects, then serves and tells the owner", async () => {
    const { transport, targets, log } = makeTargets();

    await start(targets, log);

    expect(transport.events).toEqual(["onMessage", "connect", "server start"]);
    expect(transport.texts).toEqual([
      { chatId: `${OWNER_PHONE}@s.whatsapp.net`, text: "[INICIO]" },
    ]);
  });

  test("starts even when the owner cannot be notified", async () => {
    const { transport, targets, log, entries } = makeTargets();
    transport.failNextSends(1);

    await expect(start(targets, log)).resolves.toBeUndefined();

    expect(transport.events).toContain("server start");
    expect(entries.map((entry) => entry.level)).toEqual(["info", "warn"]);
  });

  test("does not open the notify server when the connection fails", async () => {
    const { transport, targets, log } = makeTargets();
    transport.connect = async () => {
      throw new Error("logged out");
    };

    await expect(start(targets, log)).rejects.toThrow("logged out");

    expect(transport.events).not.toContain("server start");
  });
});

describe("stop", () => {
  test("stops intake first and closes the connection last", async () => {
    const { transport, targets, log } = makeTargets();

    await stop(targets, log);

    expect(transport.events).toEqual([
      "stopReceiving",
      "server stop",
      "disconnect",
    ]);
  });

  test("runs the remaining steps when one fails", async () => {
    const { transport, targets, log, entries } = makeTargets();
    targets.notifyServer.stop = async () => {
      throw new Error("port busy");
    };

    await stop(targets, log);

    expect(transport.events).toEqual(["stopReceiving", "disconnect"]);
    expect(entries).toContainEqual({
      level: "error",
      message: "Shutdown step failed",
      metadata: { step: "notify server", error: "port busy" },
    });
  });
});
