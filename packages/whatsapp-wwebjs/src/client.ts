import { Client, LocalAuth } from "whatsapp-web.js";
import { deliverQr, type Logger, type QrHandler } from "@bot-whatsapp/whatsapp";

const PUPPETEER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--no-zygote",
  "--disable-gpu",
] as const;

export interface WwebjsClientOptions {
  readonly chromePath?: string;
  readonly onQr?: QrHandler;
}

export function createClient(
  options: WwebjsClientOptions,
  logger: Logger
): Client {
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: [...PUPPETEER_ARGS],
      executablePath: options.chromePath,
    },
  });
  watchClient(client, logger, options.onQr);
  return client;
}

export function watchClient(
  client: Client,
  logger: Logger,
  onQr?: QrHandler
): void {
  client.on("qr", (qr) => {
    logger("info", "QR code generated. Scan with WhatsApp.", {
      event: "whatsapp_qr_generated",
    });
    deliverQr(qr, onQr, logger);
  });

  client.on("auth_failure", (message) => {
    logger("error", "WhatsApp authentication failed", {
      event: "whatsapp_auth_failure",
      message,
    });
  });

  client.on("disconnected", (reason) => {
    logger("error", "WhatsApp disconnected", {
      event: "whatsapp_disconnected",
      reason,
    });
  });

  client.on("ready", () => {
    logger("info", "WhatsApp client ready", { event: "whatsapp_client_ready" });
  });
}

// Rejects on auth_failure or a disconnect before ready: the client then never
// becomes ready, so waiting for "ready" alone would hang startup instead of
// failing it.
export async function connect(client: Client): Promise<void> {
  const ready = new Promise<void>((resolve, reject) => {
    const settle = (finish: () => void): void => {
      client.off("ready", onReady);
      client.off("auth_failure", onAuthFailure);
      client.off("disconnected", onDisconnected);
      finish();
    };
    const onReady = (): void => settle(resolve);
    const onAuthFailure = (message: string): void =>
      settle(() =>
        reject(new Error(`WhatsApp authentication failed: ${message}`))
      );
    const onDisconnected = (reason: string): void =>
      settle(() => reject(new Error(`WhatsApp disconnected: ${reason}`)));
    client.on("ready", onReady);
    client.on("auth_failure", onAuthFailure);
    client.on("disconnected", onDisconnected);
  });
  await Promise.all([client.initialize(), ready]);
}
