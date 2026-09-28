import { afterEach, describe, expect, test } from "vitest";
import type { TransportFactories } from "../src/bootstrap/container";
import { run, type RunningBot } from "../src/bootstrap/run";
import { FakeTransport, OWNER_PHONE } from "./fixtures";

// A port nothing listens on: bind an ephemeral one, then release it.
function freePort(): number {
  const server = Bun.serve({ port: 0, fetch: () => new Response() });
  const port = server.port!;
  void server.stop(true);
  return port;
}

function setup(env: Record<string, string>) {
  const transport = new FakeTransport();
  const built: string[] = [];
  const factories: TransportFactories = {
    async baileys() {
      built.push("baileys");
      return transport;
    },
    async wwebjs() {
      built.push("wwebjs");
      return transport;
    },
  };
  const start = () =>
    run({
      env: {
        OWNER_PHONE,
        SUPABASE_URL: "https://abc.supabase.co",
        SUPABASE_KEY: "k".repeat(32),
        LOG_LEVEL: "error",
        HTTP_PORT: String(freePort()),
        ...env,
      },
      factories,
      renderQr: () => {},
    });
  return { start, transport, built };
}

describe("run", () => {
  let running: RunningBot | undefined;

  afterEach(async () => {
    await running?.container.notifyServer.stop();
    running = undefined;
  });

  test("listens, connects the configured transport and tells the owner", async () => {
    const { start, transport, built } = setup({
      WHATSAPP_TRANSPORT: "wwebjs",
    });

    running = await start();

    expect(built).toEqual(["wwebjs"]);
    expect(transport.events).toEqual(["onMessage", "connect"]);
    expect(transport.texts).toEqual([
      { chatId: `${OWNER_PHONE}@s.whatsapp.net`, text: "[INICIO]" },
    ]);
  });

  test("uses Baileys when no transport is configured", async () => {
    const { start, built } = setup({});

    running = await start();

    expect(built).toEqual(["baileys"]);
  });

  test("stops before building anything when the configuration is invalid", async () => {
    const { start, transport, built } = setup({ OWNER_PHONE: "abc" });

    await expect(start()).rejects.toThrow("OWNER_PHONE");

    expect(built).toEqual([]);
    expect(transport.events).toEqual([]);
  });
});
