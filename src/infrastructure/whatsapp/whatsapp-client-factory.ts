import { Client, LocalAuth } from "whatsapp-web.js";
import { logger } from "../monitoring/logger";

export class WhatsAppClientFactory {
  constructor(private readonly chromePath?: string) {}

  async create(): Promise<Client> {
    const client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
        ],
        executablePath: this.chromePath,
      },
    });

    this.setupEventListeners(client);

    return client;
  }

  private setupEventListeners(client: Client): void {
    client.on("qr", () => {
      logger.info("QR code generated. Scan with WhatsApp");
    });

    client.on("ready", () => {
      logger.info("WhatsApp client ready");
    });

    client.on("auth_failure", (message) => {
      logger.error("WhatsApp authentication failed", { message });
    });

    client.on("disconnected", (reason) => {
      logger.error("WhatsApp client disconnected", { reason });
    });
  }
}
