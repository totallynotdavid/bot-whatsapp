import { Client, LocalAuth } from "whatsapp-web.js";

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

export function createClient(options: WwebjsClientOptions = {}): Client {
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: [...PUPPETEER_ARGS],
      executablePath: options.chromePath,
    },
  });

  client.on("qr", () => {
    console.log(
      JSON.stringify({
        event: "whatsapp_qr_generated",
        message: "QR code generated. Scan with WhatsApp.",
      })
    );
  });

  client.on("auth_failure", (message) => {
    console.error(JSON.stringify({ event: "whatsapp_auth_failure", message }));
  });

  client.on("disconnected", (reason) => {
    console.error(JSON.stringify({ event: "whatsapp_disconnected", reason }));
  });

  return client;
}

export function connect(client: Client): Promise<void> {
  const ready = new Promise<void>((resolve) => {
    client.once("ready", () => resolve());
  });
  return client.initialize().then(() => ready);
}
