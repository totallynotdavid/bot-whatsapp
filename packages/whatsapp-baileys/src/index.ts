import {
  Browsers,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import type { WhatsAppTransport } from "@bot-whatsapp/whatsapp";
import type { BaileysConnection } from "./transport";
import { BaileysTransport } from "./transport";
import type { MediaDownloader } from "./socket-types";

const DEFAULT_AUTH_DIR = ".baileys_auth";

export interface BaileysTransportOptions {
  readonly commandPrefix: string;
  readonly authDir?: string;
}

export async function createBaileysTransport(
  options: BaileysTransportOptions
): Promise<WhatsAppTransport> {
  const { state, saveCreds } = await useMultiFileAuthState(
    options.authDir ?? DEFAULT_AUTH_DIR
  );
  const { version } = await fetchLatestBaileysVersion();
  const socket = makeWASocket({
    version,
    auth: state,
    browser: Browsers.ubuntu("Chrome"),
  });

  // Registered synchronously, right after the socket is created, so the
  // first 'open' update is never missed regardless of when `connect()` is
  // later awaited: baileys starts connecting as soon as the socket exists,
  // it does not wait for a separate start call the way whatsapp-web.js does.
  let opened = false;
  let resolveOpen!: () => void;
  let rejectOpen!: (error: unknown) => void;
  const openPromise = new Promise<void>((resolve, reject) => {
    resolveOpen = resolve;
    rejectOpen = reject;
  });

  socket.ev.on("creds.update", saveCreds);
  socket.ev.on("connection.update", (update) => {
    if (update.qr) {
      console.log(
        JSON.stringify({
          event: "whatsapp_qr_generated",
          message: "QR code generated. Scan with WhatsApp.",
        })
      );
    }
    if (update.connection === "open" && !opened) {
      opened = true;
      resolveOpen();
    }
    if (update.connection === "close") {
      console.error(
        JSON.stringify({
          event: "whatsapp_disconnected",
          reason: update.lastDisconnect?.error?.message,
        })
      );
      if (!opened) {
        rejectOpen(
          update.lastDisconnect?.error ??
            new Error("WhatsApp connection closed")
        );
      }
    }
  });

  const connection: BaileysConnection = {
    connect: () => openPromise,
    disconnect: () => socket.end(undefined),
  };

  const downloadContent: MediaDownloader = (message) =>
    downloadMediaMessage(message, "buffer", {});

  return new BaileysTransport(
    connection,
    socket,
    options.commandPrefix,
    downloadContent
  );
}
