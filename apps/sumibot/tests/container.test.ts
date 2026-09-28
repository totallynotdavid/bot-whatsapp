import { describe, expect, test } from "vitest";
import {
  buildContainer,
  type TransportFactories,
} from "../src/bootstrap/container";
import { loadConfig } from "../src/config";
import { FakeTransport, OWNER_PHONE, recordingLogger } from "./fixtures";

const ENV = {
  OWNER_PHONE,
  SUPABASE_URL: "https://abc.supabase.co",
  SUPABASE_KEY: "k".repeat(32),
};

interface Call {
  readonly adapter: "baileys" | "wwebjs";
  readonly options: {
    logger: unknown;
    onQr: (qr: string) => void;
    chromePath?: string;
  };
}

// Factories that build a fake transport and record how they were asked to,
// so no adapter package loads and nothing can reach WhatsApp.
function fakeFactories() {
  const calls: Call[] = [];
  const transport = new FakeTransport();
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

function setup(env: Record<string, string> = {}) {
  const { log, entries } = recordingLogger();
  const rendered: string[] = [];
  const fakes = fakeFactories();
  const build = () =>
    buildContainer(loadConfig({ ...ENV, ...env }), log, {
      factories: fakes.factories,
      renderQr: (qr) => rendered.push(qr),
    });
  return { build, log, entries, rendered, ...fakes };
}

describe("buildContainer", () => {
  test("builds the Baileys transport by default", async () => {
    const { build, calls, transport, log } = setup();

    const container = await build();

    expect(calls.map((call) => call.adapter)).toEqual(["baileys"]);
    expect(calls[0]?.options.logger).toBe(log);
    expect(container.transport).toBe(transport);
    expect(container.ownerPhone).toBe(OWNER_PHONE);
  });

  test("builds the whatsapp-web.js transport, with the Chrome path, when configured", async () => {
    const { build, calls } = setup({
      WHATSAPP_TRANSPORT: "wwebjs",
      CHROME_PATH: "/usr/bin/chromium",
    });

    await build();

    expect(calls.map((call) => call.adapter)).toEqual(["wwebjs"]);
    expect(calls[0]?.options.chromePath).toBe("/usr/bin/chromium");
  });

  test.each(["baileys", "wwebjs"])(
    "hands the %s transport a QR handler that renders the code",
    async (transportName) => {
      const { build, calls, rendered } = setup({
        WHATSAPP_TRANSPORT: transportName,
      });
      await build();

      calls[0]!.options.onQr("2@pairing-payload");

      expect(rendered).toEqual(["2@pairing-payload"]);
    }
  );

  test("never logs the QR payload", async () => {
    const { build, calls, entries } = setup();
    await build();

    calls[0]!.options.onQr("2@pairing-payload");

    expect(JSON.stringify(entries)).not.toContain("pairing-payload");
  });

  test("does not connect the transport", async () => {
    const { build, transport } = setup();

    await build();

    expect(transport.events).toEqual([]);
  });

  test("sends replies once, even when the transport drops one", async () => {
    const { build, transport } = setup();
    const { sender } = await build();
    transport.failNextSends(1);

    await expect(sender.sendText("chat", "hola")).rejects.toThrow(
      "connection closed"
    );

    expect(transport.texts).toEqual([]);
  });

  test("retries a media download the transport drops", async () => {
    const { build, transport } = setup();
    const { sender } = await build();
    transport.attachMedia("msg-1", "jpeg-bytes");
    transport.failNextDownloads(1);

    const media = await sender.downloadMedia("msg-1");

    expect(media?.buffer.toString()).toBe("jpeg-bytes");
  });

  test("builds a handler for the configured prefix", async () => {
    const { build } = setup({ COMMAND_PREFIX: "#" });
    const { handler } = await build();

    expect(handler.isCommand("#estado")).toBe(true);
    expect(handler.isCommand("!estado")).toBe(false);
  });
});
