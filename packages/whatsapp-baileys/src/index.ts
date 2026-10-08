import { rm } from "node:fs/promises";
import {
  Browsers,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import {
  consoleLogger,
  type Logger,
  type QrHandler,
  type WhatsAppTransport,
} from "@bot-whatsapp/whatsapp";
import type { RawBaileysSocket } from "./connection";
import { ReconnectingBaileysSocket } from "./reconnecting-socket";
import { createBaileysConnection, type LibrarySession } from "./session";
import type { MediaDownloader } from "./socket-types";
import { BaileysTransport } from "./transport";

const DEFAULT_AUTH_DIR = ".baileys_auth";

export interface BaileysTransportOptions {
  readonly authDir?: string;
  readonly logger?: Logger;
  readonly onQr?: QrHandler;
}

// Baileys accepts any object shaped like pino's Logger (see ILogger in
// @whiskeysockets/baileys/lib/Utils/logger); it is not exported from the
// package root, so this is structurally compatible rather than imported.
interface MinimalBaileysLogger {
  level: string;
  child(obj: Record<string, unknown>): MinimalBaileysLogger;
  trace(obj: unknown, msg?: string): void;
  debug(obj: unknown, msg?: string): void;
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

// Baileys' own pino logger is very verbose at info/debug; route only
// warnings and errors through the app's logger instead of letting it write
// straight to the console.
function bridgeLibraryLogger(logger: Logger): MinimalBaileysLogger {
  const forward = (level: "warn" | "error", obj: unknown, msg?: string) => {
    const message =
      msg ?? (typeof obj === "string" ? obj : "baileys library log");
    const metadata =
      typeof obj === "object" && obj !== null
        ? (obj as Record<string, unknown>)
        : undefined;
    logger(level, message, metadata);
  };
  const bridged: MinimalBaileysLogger = {
    level: "warn",
    child: () => bridged,
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: (obj, msg) => forward("warn", obj, msg),
    error: (obj, msg) => forward("error", obj, msg),
  };
  return bridged;
}

// The socket is created inside connect(), not here, so "no message can
// arrive before anything is listening" holds: onMessage only ever
// registers against the ReconnectingBaileysSocket proxy, which has nothing
// to deliver until connect() attaches a real socket to it.
export function createBaileysTransport(
  options: BaileysTransportOptions
): WhatsAppTransport {
  const logger = options.logger ?? consoleLogger;
  const authDir = options.authDir ?? DEFAULT_AUTH_DIR;
  const proxy = new ReconnectingBaileysSocket();

  const connection = createBaileysConnection(
    proxy,
    () => openLibrary(authDir, logger),
    logger,
    options.onQr
  );

  const downloadContent: MediaDownloader = (message) =>
    downloadMediaMessage(message, "buffer", {});

  return new BaileysTransport(connection, proxy, downloadContent, logger);
}

async function openLibrary(
  authDir: string,
  logger: Logger
): Promise<LibrarySession> {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  return {
    saveCreds,
    clearCredentials: () => rm(authDir, { recursive: true, force: true }),
    buildSocket: () =>
      makeWASocket({
        version,
        auth: state,
        browser: Browsers.ubuntu("Chrome"),
        logger: bridgeLibraryLogger(logger),
      }) as RawBaileysSocket,
  };
}
