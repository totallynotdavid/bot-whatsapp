import { Client, LocalAuth } from "whatsapp-web.js";
import { log } from "../../lib/logging/logger";

const PUPPETEER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--no-zygote",
  "--disable-gpu",
] as const;

export class WhatsAppClient {
  private readonly client: Client;

  constructor(chromePath?: string) {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: [...PUPPETEER_ARGS],
        executablePath: chromePath,
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on("qr", () => {
      log("info", "QR code generated. Scan with WhatsApp.");
    });

    this.client.on("ready", () => {
      log("info", "WhatsApp client ready");
    });

    this.client.on("auth_failure", (message) => {
      log("error", "WhatsApp authentication failed", { message });
    });

    this.client.on("disconnected", (reason) => {
      log("error", "WhatsApp client disconnected", { reason });
    });
  }

  async initialize(): Promise<void> {
    await this.client.initialize();

    return new Promise((resolve) => {
      this.client.once("ready", () => {
        resolve();
      });
    });
  }

  getClient(): Client {
    return this.client;
  }
}
