import { EventEmitter } from "node:events";
import { DisconnectReason } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { describe, expect, test } from "vitest";
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

describe("Baileys reconnect loop", () => {
  test("resolves once the socket opens", async () => {
    const proxy = new ReconnectingBaileysSocket();
    const sockets: FakeRawSocket[] = [];
    const buildSocket = () => {
      const socket = new FakeRawSocket();
      sockets.push(socket);
      return socket;
    };

    const connected = manageConnection(
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
    const sockets: FakeRawSocket[] = [];
    const buildSocket = () => {
      const socket = new FakeRawSocket();
      sockets.push(socket);
      return socket;
    };

    const connected = manageConnection(
      buildSocket,
      proxy,
      () => {},
      silentLogger
    );

    sockets[0]!.emitClose(DisconnectReason.restartRequired);
    expect(sockets).toHaveLength(2);

    let rejected = false;
    connected.catch(() => {
      rejected = true;
    });
    await Promise.resolve();
    expect(rejected).toBe(false);

    sockets[1]!.emitOpen();
    await expect(connected).resolves.toBeUndefined();
  });

  test("a loggedOut close before the first open rejects connect()", async () => {
    const proxy = new ReconnectingBaileysSocket();
    const sockets: FakeRawSocket[] = [];
    const buildSocket = () => {
      const socket = new FakeRawSocket();
      sockets.push(socket);
      return socket;
    };

    const connected = manageConnection(
      buildSocket,
      proxy,
      () => {},
      silentLogger
    );
    sockets[0]!.emitClose(DisconnectReason.loggedOut);

    await expect(connected).rejects.toThrow("closed");
    expect(sockets).toHaveLength(1);
  });

  test("after connecting, a non-loggedOut close reconnects with a new socket", async () => {
    const proxy = new ReconnectingBaileysSocket();
    const sockets: FakeRawSocket[] = [];
    const buildSocket = () => {
      const socket = new FakeRawSocket();
      sockets.push(socket);
      return socket;
    };

    const connected = manageConnection(
      buildSocket,
      proxy,
      () => {},
      silentLogger
    );
    sockets[0]!.emitOpen();
    await connected;

    sockets[0]!.emitClose(DisconnectReason.connectionLost);
    expect(sockets).toHaveLength(2);
  });

  test("after connecting, a loggedOut close ends the connection without reconnecting", async () => {
    const proxy = new ReconnectingBaileysSocket();
    const sockets: FakeRawSocket[] = [];
    const buildSocket = () => {
      const socket = new FakeRawSocket();
      sockets.push(socket);
      return socket;
    };

    const connected = manageConnection(
      buildSocket,
      proxy,
      () => {},
      silentLogger
    );
    sockets[0]!.emitOpen();
    await connected;

    sockets[0]!.emitClose(DisconnectReason.loggedOut);
    expect(sockets).toHaveLength(1);
  });

  test("swaps the proxy to the rebuilt socket so listeners keep receiving events", async () => {
    const proxy = new ReconnectingBaileysSocket();
    const sockets: FakeRawSocket[] = [];
    const buildSocket = () => {
      const socket = new FakeRawSocket();
      sockets.push(socket);
      return socket;
    };
    const seen: string[] = [];
    proxy.ev.on("messages.upsert", async ({ type }) => {
      seen.push(type);
    });

    const connected = manageConnection(
      buildSocket,
      proxy,
      () => {},
      silentLogger
    );
    sockets[0]!.emitClose(DisconnectReason.restartRequired);
    sockets[1]!.emitOpen();
    await connected;

    sockets[1]!.emit("messages.upsert", { messages: [], type: "notify" });
    await Promise.resolve();

    expect(seen).toEqual(["notify"]);
  });
});
