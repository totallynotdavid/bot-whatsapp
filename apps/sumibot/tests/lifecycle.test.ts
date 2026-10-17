import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { start, stop } from "../src/bootstrap/lifecycle";
import { FakeTransport, OWNER_PHONE, recordingLogger } from "./fixtures";

const noShutdown = async (): Promise<void> => {};

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

    await start(targets, log, noShutdown);

    expect(transport.events).toEqual([
      "onClose",
      "onMessage",
      "connect",
      "server start",
    ]);
    expect(transport.texts).toEqual([
      { chatId: `${OWNER_PHONE}@s.whatsapp.net`, text: "[INICIO]" },
    ]);
  });

  test("starts even when the owner cannot be notified", async () => {
    const { transport, targets, log, entries } = makeTargets();
    transport.failNextSends(1);

    await expect(start(targets, log, noShutdown)).resolves.toBeUndefined();

    expect(transport.events).toContain("server start");
    expect(entries.map((entry) => entry.level)).toEqual(["info", "warn"]);
  });

  test("does not open the notify server when the connection fails", async () => {
    const { transport, targets, log } = makeTargets();
    transport.connect = async () => {
      throw new Error("logged out");
    };

    await expect(start(targets, log, noShutdown)).rejects.toThrow("logged out");

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

// Each case runs the bot in a child process, since process.exit cannot be
// observed from inside the test runner.
function runUntilExit(...triggers: string[]) {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("./scripts/close-session.ts", import.meta.url)),
      ...triggers,
    ],
    { encoding: "utf8", timeout: 20_000 }
  );
  const events = /^events:(.*)$/m.exec(result.stdout)?.[1]?.split(",");
  return { ...result, events };
}

describe("shutting down", () => {
  const SHUTDOWN_EVENTS = ["stopReceiving", "disconnect"];

  test("a session the transport ends for good is logged", () => {
    const result = runUntilExit("close");

    expect(result.stdout).not.toContain("did not exit");
    expect(result.stderr).toContain("WhatsApp session ended; exiting");
  });

  // The first trigger decides the exit code. Later ones close nothing again.
  test.each([
    [["close"], 1],
    [["signal"], 0],
    [["signal", "close"], 0],
    [["close", "signal"], 1],
    [["close", "close"], 1],
  ])("triggers %j shut down once and exit %i", (triggers, status) => {
    const result = runUntilExit(...triggers);

    expect(result.events).toEqual(SHUTDOWN_EVENTS);
    expect(result.status).toBe(status);
  });
});
