import { DisconnectReason } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import type { Logger } from "@bot-whatsapp/whatsapp";
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

// Resolves once the socket first opens. A close with statusCode ===
// loggedOut is fatal: it rejects (if that happens before the first open) or
// otherwise ends an already-running connection with no further retry. Any
// other close, including restartRequired during the very first pairing,
// rebuilds the socket via `buildSocket` and keeps waiting on the same
// promise instead of rejecting it.
export function manageConnection(
  buildSocket: () => RawBaileysSocket,
  proxy: ReconnectingBaileysSocket,
  saveCreds: () => void,
  logger: Logger
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const attach = (): void => {
      const socket = buildSocket();
      proxy.swap(socket);
      socket.ev.on("creds.update", saveCreds);
      socket.ev.on("connection.update", (update) => {
        if (update.qr) {
          logger("info", "QR code generated. Scan with WhatsApp.", {
            event: "whatsapp_qr_generated",
          });
        }

        if (update.connection === "open") {
          logger("info", "WhatsApp client ready", {
            event: "whatsapp_client_ready",
          });
          if (!settled) {
            settled = true;
            resolve();
          }
        }

        if (update.connection === "close") {
          const error = update.lastDisconnect?.error;
          const statusCode =
            error instanceof Boom ? error.output.statusCode : undefined;
          const loggedOut = statusCode === DisconnectReason.loggedOut;

          logger(loggedOut ? "error" : "warn", "WhatsApp disconnected", {
            event: "whatsapp_disconnected",
            reason: error?.message,
            statusCode,
            reconnecting: !loggedOut,
          });

          if (loggedOut) {
            if (!settled) {
              settled = true;
              reject(error ?? new Error("WhatsApp connection closed"));
            }
            return;
          }

          attach();
        }
      });
    };

    attach();
  });
}
