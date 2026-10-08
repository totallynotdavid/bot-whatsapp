import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DisconnectReason } from "@whiskeysockets/baileys";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ReconnectingBaileysSocket } from "../src/reconnecting-socket";
import { createBaileysConnection } from "../src/session";
import { FakeRawSocket, recordingLogger } from "./fixtures";

let authDir: string;

beforeEach(async () => {
  authDir = await mkdtemp(join(tmpdir(), "baileys-auth-"));
  await writeFile(join(authDir, "creds.json"), "{}");
});

afterEach(async () => {
  await rm(authDir, { recursive: true, force: true });
});

function newSession(options: { failClearing?: boolean } = {}) {
  const sockets: FakeRawSocket[] = [];
  const { logger, entries } = recordingLogger();
  const connection = createBaileysConnection(
    new ReconnectingBaileysSocket(),
    async () => ({
      saveCreds: () => {},
      clearCredentials: async () => {
        if (options.failClearing) throw new Error("directory is locked");
        await rm(authDir, { recursive: true, force: true });
      },
      buildSocket: () => {
        const socket = new FakeRawSocket();
        sockets.push(socket);
        return socket;
      },
    }),
    logger
  );

  // Starts connect() and returns the library socket once it is built.
  const startConnecting = async () => {
    const connecting = connection.connect();
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    return { connecting, socket: sockets[0]! };
  };

  const openConnection = async () => {
    const { connecting, socket } = await startConnecting();
    socket.emitOpen();
    await connecting;
    return socket;
  };

  return { connection, entries, startConnecting, openConnection };
}

describe("Baileys credentials after a revoked session", () => {
  test("a loggedOut close before the first open clears them before connect() rejects", async () => {
    const { startConnecting } = newSession();
    const { connecting, socket } = await startConnecting();

    socket.emitClose(DisconnectReason.loggedOut);

    await expect(connecting).rejects.toThrow("closed");
    expect(existsSync(authDir)).toBe(false);
  });

  test("a loggedOut close after connecting clears them before onClose runs", async () => {
    const { connection, openConnection } = newSession();
    const credentialsPresentAtClose: boolean[] = [];
    connection.onClose(() =>
      credentialsPresentAtClose.push(existsSync(authDir))
    );
    const socket = await openConnection();

    socket.emitClose(DisconnectReason.loggedOut);

    await vi.waitFor(() => expect(credentialsPresentAtClose).toEqual([false]));
  });

  test("a connectionReplaced close keeps them", async () => {
    const { connection, openConnection } = newSession();
    const closed: Error[] = [];
    connection.onClose((error) => closed.push(error));
    const socket = await openConnection();

    socket.emitClose(DisconnectReason.connectionReplaced);

    await vi.waitFor(() => expect(closed).toHaveLength(1));
    expect(existsSync(authDir)).toBe(true);
  });

  test("a deliberate disconnect keeps them", async () => {
    const { connection, openConnection } = newSession();
    await openConnection();

    await connection.disconnect();

    expect(existsSync(authDir)).toBe(true);
  });

  test("a failure to clear them is logged and the close is still reported", async () => {
    const { connection, entries, openConnection } = newSession({
      failClearing: true,
    });
    const closed: Error[] = [];
    connection.onClose((error) => closed.push(error));
    const socket = await openConnection();

    socket.emitClose(DisconnectReason.loggedOut);

    await vi.waitFor(() => expect(closed).toHaveLength(1));
    expect(entries).toContainEqual(
      expect.objectContaining({
        level: "error",
        message: "Could not clear revoked WhatsApp credentials",
        metadata: { error: "directory is locked" },
      })
    );
  });
});
