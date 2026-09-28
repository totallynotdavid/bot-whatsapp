import { Client, LocalAuth } from "whatsapp-web.js";
import type { Logger } from "@bot-whatsapp/whatsapp";

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

  client.on("qr", () => {
    logger("info", "QR code generated. Scan with WhatsApp.", {
      event: "whatsapp_qr_generated",
    });
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

  return client;
}

export function connect(client: Client): Promise<void> {
  const ready = new Promise<void>((resolve) => {
    client.once("ready", () => resolve());
  });
  return client.initialize().then(() => ready);
}
