import { EventEmitter } from "node:events";
import { DisconnectReason } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { RawBaileysSocket } from "../src/connection";
import { manageConnection } from "../src/connection";
import { ReconnectingBaileysSocket } from "../src/reconnecting-socket";
import { silentLogger } from "./fixtures";

// Fakes just enough of the raw WASocket surface for manageConnection: the
// connection lifecycle events, plus the narrow BaileysSocket methods it
// forwards through ReconnectingBaileysSocket.swap.
class FakeRawSocket extends EventEmitter implements RawBaileysSocket {
  readonly ev = {
    on: (event: string, listener: (...args: unknown[]) => void) => {
      this.on(event, listener);
    },
    off: (event: string, listener: (...args: unknown[]) => void) => {
      this.off(event, listener);
    },
  } as RawBaileysSocket["ev"];

  emitOpen(): void {
    this.emit("connection.update", { connection: "open" });
  }

  emitClose(statusCode: number | undefined): void {
    const error =
      statusCode === undefined ? undefined : new Boom("closed", { statusCode });
    this.emit("connection.update", {
      connection: "close",
      lastDisconnect: { error },
    });
  }

  async sendMessage(): Promise<undefined> {
    return undefined;
  }

  async groupMetadata(): Promise<never> {
    throw new Error("not used by these tests");
  }

  async groupParticipantsUpdate(): Promise<unknown> {
    return [];
  }

  async profilePictureUrl(): Promise<string | undefined> {
    return undefined;
  }

  async end(): Promise<void> {}
}

function newBuildSocket(): {
  buildSocket: () => FakeRawSocket;
  sockets: FakeRawSocket[];
} {
  const sockets: FakeRawSocket[] = [];
  const buildSocket = () => {
    const socket = new FakeRawSocket();
    sockets.push(socket);
    return socket;
  };
  return { buildSocket, sockets };
}

describe("Baileys reconnect loop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("resolves once the socket opens", async () => {
    const proxy = new ReconnectingBaileysSocket();
    const { buildSocket, sockets } = newBuildSocket();

    const { connected } = manageConnection(
      buildSocket,
      proxy,
      () => {},
      silentLogger
    );
    sockets[0]!.emitOpen();

    await expect(connected).resolves.toBeUndefined();
    expect(sockets).toHaveLength(1);
  });

  test("a restartRequired close during first pairing rebuilds the socket instead of rejecting connect()", async () => {
    const proxy = new ReconnectingBaileysSocket();
    const { buildSocket, sockets } = newBuildSocket();

    const { connected } = manageConnection(
      buildSocket,
      proxy,
      () => {},
      silentLogger
    );

    sockets[0]!.emitClose(DisconnectReason.restartRequired);
    let rejected = false;
    connected.catch(() => {
      rejected = true;
    });
    await Promise.resolve();
    expect(rejected).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(2);

    sockets[1]!.emitOpen();
    await expect(connected).resolves.toBeUndefined();
  });

  test("a loggedOut close before the first open rejects connect()", async () => {
    const proxy = new ReconnectingBaileysSocket();
    const { buildSocket, sockets } = newBuildSocket();

    const { connected } = manageConnection(
      buildSocket,
      proxy,
      () => {},
      silentLogger
    );
    sockets[0]!.emitClose(DisconnectReason.loggedOut);

    await expect(connected).rejects.toThrow("closed");
    expect(sockets).toHaveLength(1);
  });

  test("a connectionReplaced (440) close rejects connect() without reconnecting, like loggedOut", async () => {
    const proxy = new ReconnectingBaileysSocket();
    const { buildSocket, sockets } = newBuildSocket();

    const { connected } = manageConnection(
      buildSocket,
      proxy,
      () => {},
      silentLogger
    );
    sockets[0]!.emitClose(DisconnectReason.connectionReplaced);

    await expect(connected).rejects.toThrow("closed");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sockets).toHaveLength(1);
  });

  test("after connecting, a non-loggedOut close reconnects with a new socket after a delay", async () => {
    const proxy = new ReconnectingBaileysSocket();
    const { buildSocket, sockets } = newBuildSocket();

    const { connected } = manageConnection(
      buildSocket,
      proxy,
      () => {},
      silentLogger
    );
    sockets[0]!.emitOpen();
    await connected;

    sockets[0]!.emitClose(DisconnectReason.connectionLost);
    expect(sockets).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(2);
  });

  test("reconnect delay doubles on repeated closes, capped at 30s, and resets once open", async () => {
    const proxy = new ReconnectingBaileysSocket();
    const { buildSocket, sockets } = newBuildSocket();

    const { connected } = manageConnection(
      buildSocket,
      proxy,
      () => {},
      silentLogger
    );
    sockets[0]!.emitOpen();
    await connected;

    sockets[0]!.emitClose(DisconnectReason.connectionLost);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(2);

    sockets[1]!.emitClose(DisconnectReason.connectionLost);
    await vi.advanceTimersByTimeAsync(1999);
    expect(sockets).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(3);

    sockets[2]!.emitClose(DisconnectReason.connectionLost);
    await vi.advanceTimersByTimeAsync(3999);
    expect(sockets).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(4);

    // Re-opens: the next close should back off from 1s again, not 8s.
    sockets[3]!.emitOpen();
    sockets[3]!.emitClose(DisconnectReason.connectionLost);
    await vi.advanceTimersByTimeAsync(999);
    expect(sockets).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(5);
  });

  test("after connecting, a loggedOut close ends the connection without reconnecting", async () => {
    const proxy = new ReconnectingBaileysSocket();
    const { buildSocket, sockets } = newBuildSocket();

    const { connected } = manageConnection(
      buildSocket,
      proxy,
      () => {},
      silentLogger
    );
    sockets[0]!.emitOpen();
    await connected;

    sockets[0]!.emitClose(DisconnectReason.loggedOut);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sockets).toHaveLength(1);
  });

  test("swaps the proxy to the rebuilt socket so listeners keep receiving events", async () => {
    const proxy = new ReconnectingBaileysSocket();
    const { buildSocket, sockets } = newBuildSocket();
    const seen: string[] = [];
    proxy.ev.on("messages.upsert", async ({ type }) => {
      seen.push(type);
    });

    const { connected } = manageConnection(
      buildSocket,
      proxy,
      () => {},
      silentLogger
    );
    sockets[0]!.emitClose(DisconnectReason.restartRequired);
    await vi.advanceTimersByTimeAsync(1000);
    sockets[1]!.emitOpen();
    await connected;

    sockets[1]!.emit("messages.upsert", { messages: [], type: "notify" });
    await Promise.resolve();

    expect(seen).toEqual(["notify"]);
  });

  test("controller.stop() after an intentional close (end()) prevents the reconnect that close would otherwise trigger", async () => {
    const proxy = new ReconnectingBaileysSocket();
    const { buildSocket, sockets } = newBuildSocket();

    const { connected, controller } = manageConnection(
      buildSocket,
      proxy,
      () => {},
      silentLogger
    );
    sockets[0]!.emitOpen();
    await connected;

    // A deliberate disconnect(): stop() first, exactly as index.ts does,
    // then the socket's own end() call reports a close with no error, just
    // as Baileys' real end() does.
    controller.stop();
    sockets[0]!.emitClose(undefined);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(sockets).toHaveLength(1);
  });

  test("controller.stop() cancels a reconnect already scheduled by an earlier close", async () => {
    const proxy = new ReconnectingBaileysSocket();
    const { buildSocket, sockets } = newBuildSocket();

    const { connected, controller } = manageConnection(
      buildSocket,
      proxy,
      () => {},
      silentLogger
    );
    sockets[0]!.emitOpen();
    await connected;

    sockets[0]!.emitClose(DisconnectReason.connectionLost);
    // A reconnect is now scheduled but has not fired yet.
    controller.stop();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(sockets).toHaveLength(1);
  });
});
