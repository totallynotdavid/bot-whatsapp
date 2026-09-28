import { DisconnectReason } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { deliverQr, type Logger, type QrHandler } from "@bot-whatsapp/whatsapp";
import type { ReconnectingBaileysSocket } from "./reconnecting-socket";
import type { BaileysSocket } from "./socket-types";

interface ConnectionUpdate {
  readonly qr?: string;
  readonly connection?: "connecting" | "open" | "close";
  readonly lastDisconnect?: { readonly error?: Error };
}

// The events makeWASocket()'s return value carries beyond the narrow
// BaileysSocket surface receiver/sender use: connection lifecycle and
// credential persistence, both only relevant while (re)establishing the
// connection.
export interface RawBaileysSocket extends BaileysSocket {
  readonly ev: BaileysSocket["ev"] & {
    on(event: "creds.update", listener: () => void): void;
    on(
      event: "connection.update",
      listener: (update: ConnectionUpdate) => void
    ): void;
  };
}

// loggedOut means the session was revoked; connectionReplaced (440) means
// another session took its place. Reconnecting after either just fights the
// server (or a newer session) in a hot loop, so both end the connection
// instead of retrying.
const FATAL_DISCONNECT_REASONS: ReadonlySet<number> = new Set([
  DisconnectReason.loggedOut,
  DisconnectReason.connectionReplaced,
]);

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;

// Returned to the caller so a deliberate disconnect() can stop future
// reconnects and cancel one already scheduled, instead of manageConnection
// treating its own end() call as a server-initiated drop to recover from.
export interface ConnectionController {
  stop(): void;
}

export interface ManagedConnection {
  readonly connected: Promise<void>;
  readonly controller: ConnectionController;
}

// Resolves once the socket first opens. A close with statusCode ===
// loggedOut or connectionReplaced is fatal: it rejects (if that happens
// before the first open) or otherwise ends an already-running connection
// with no further retry. Any other close, including restartRequired during
// the very first pairing, rebuilds the socket via `buildSocket` after a
// capped exponential backoff (reset once the connection opens) and keeps
// waiting on the same promise instead of rejecting it. Calling the returned
// controller's stop() (from a deliberate disconnect()) cancels a pending
// reconnect and prevents any future one.
export function manageConnection(
  buildSocket: () => RawBaileysSocket,
  proxy: ReconnectingBaileysSocket,
  saveCreds: () => void,
  logger: Logger,
  onQr?: QrHandler
): ManagedConnection {
  let settled = false;
  let stopping = false;
  let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const controller: ConnectionController = {
    stop() {
      stopping = true;
      if (reconnectTimer !== undefined) {
        clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
    },
  };

  const connected = new Promise<void>((resolve, reject) => {
    const attach = (): void => {
      const socket = buildSocket();
      proxy.swap(socket);
      socket.ev.on("creds.update", saveCreds);
      socket.ev.on("connection.update", (update) => {
        if (update.qr) {
          logger("info", "QR code generated. Scan with WhatsApp.", {
            event: "whatsapp_qr_generated",
          });
          deliverQr(update.qr, onQr, logger);
        }

        if (update.connection === "open") {
          reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
          logger("info", "WhatsApp client ready", {
            event: "whatsapp_client_ready",
          });
          if (!settled) {
            settled = true;
            resolve();
          }
        }

        if (update.connection === "close") {
          if (stopping) {
            if (!settled) {
              settled = true;
              resolve();
            }
            return;
          }

          const error = update.lastDisconnect?.error;
          const statusCode =
            error instanceof Boom ? error.output.statusCode : undefined;
          const fatal =
            statusCode !== undefined &&
            FATAL_DISCONNECT_REASONS.has(statusCode);

          logger(fatal ? "error" : "warn", "WhatsApp disconnected", {
            event: "whatsapp_disconnected",
            reason: error?.message,
            statusCode,
            reconnecting: !fatal,
          });

          if (fatal) {
            if (!settled) {
              settled = true;
              reject(error ?? new Error("WhatsApp connection closed"));
            }
            return;
          }

          const delay = reconnectDelayMs;
          reconnectDelayMs = Math.min(
            reconnectDelayMs * 2,
            MAX_RECONNECT_DELAY_MS
          );
          reconnectTimer = setTimeout(() => {
            reconnectTimer = undefined;
            if (!stopping) attach();
          }, delay);
        }
      });
    };

    attach();
  });

  return { connected, controller };
}
