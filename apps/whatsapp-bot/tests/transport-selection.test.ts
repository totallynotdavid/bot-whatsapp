import type { WhatsAppTransport } from "@bot-whatsapp/whatsapp";
import { describe, expect, test } from "vitest";
import {
  createTransport,
  type TransportFactories,
} from "../src/bootstrap/container";
import { configSchema } from "../src/config/schema";
import { OWNER_PHONE } from "./fixtures";

const ENV = {
  OWNER_PHONE,
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_KEY: "x".repeat(32),
};

interface Call {
  readonly adapter: "baileys" | "wwebjs";
  readonly options: { onQr: (qr: string) => void; chromePath?: string };
}

// Factories that hand back a marker instead of a transport, so no adapter
// package loads and nothing can reach WhatsApp.
function fakeFactories() {
  const calls: Call[] = [];
  const transport = {} as WhatsAppTransport;
  const factories: TransportFactories = {
    async baileys(options) {
      calls.push({ adapter: "baileys", options });
      return transport;
    },
    async wwebjs(options) {
      calls.push({ adapter: "wwebjs", options });
      return transport;
    },
  };
  return { factories, calls, transport };
}

describe("createTransport", () => {
  test("builds the whatsapp-web.js transport by default, with the Chrome path", async () => {
    const { factories, calls, transport } = fakeFactories();
    const config = configSchema.parse({
      ...ENV,
      CHROME_PATH: "/usr/bin/chrome",
    });

    const built = await createTransport(config, { factories });

    expect(built).toBe(transport);
    expect(calls.map((call) => call.adapter)).toEqual(["wwebjs"]);
    expect(calls[0]?.options.chromePath).toBe("/usr/bin/chrome");
  });

  test("builds the Baileys transport when configured", async () => {
    const { factories, calls } = fakeFactories();
    const config = configSchema.parse({
      ...ENV,
      WHATSAPP_TRANSPORT: "baileys",
    });

    await createTransport(config, { factories });

    expect(calls.map((call) => call.adapter)).toEqual(["baileys"]);
  });

  test.each(["wwebjs", "baileys"])(
    "hands the %s transport a QR handler that renders the code",
    async (transportName) => {
      const { factories, calls } = fakeFactories();
      const rendered: string[] = [];
      const config = configSchema.parse({
        ...ENV,
        WHATSAPP_TRANSPORT: transportName,
      });

      await createTransport(config, {
        factories,
        renderQr: (qr) => rendered.push(qr),
      });
      calls[0]!.options.onQr("2@pairing-payload");

      expect(rendered).toEqual(["2@pairing-payload"]);
    }
  );
});
