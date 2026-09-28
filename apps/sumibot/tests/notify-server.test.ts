import { afterEach, describe, expect, test } from "vitest";
import {
  createNotifyHandler,
  createNotifyServer,
} from "../src/infrastructure/http/notify-server";
import { FakeTransport, OWNER_PHONE, recordingLogger } from "./fixtures";

function setup() {
  const transport = new FakeTransport();
  const { log, entries } = recordingLogger();
  return {
    transport,
    entries,
    handle: createNotifyHandler(transport, OWNER_PHONE, log),
  };
}

function post(body: unknown, path = "/send-message"): Request {
  return new Request(`http://bot.local${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /send-message", () => {
  test("sends the text to the given number", async () => {
    const { transport, handle } = setup();

    const response = await handle(
      post({ text: "hola", recipientNumber: "51988888888" })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "sent" });
    expect(transport.texts).toEqual([
      { chatId: "51988888888@s.whatsapp.net", text: "hola" },
    ]);
  });

  test("sends to a user jid, as the transport addresses that user", async () => {
    const { transport, handle } = setup();

    const response = await handle(
      post({ text: "hola", recipientNumber: "51988888888@s.whatsapp.net" })
    );

    expect(response.status).toBe(200);
    expect(transport.texts).toEqual([
      { chatId: "51988888888@s.whatsapp.net", text: "hola" },
    ]);
  });

  test("takes a user jid from another library and addresses it through the transport", async () => {
    const { transport, handle } = setup();

    await handle(post({ text: "hola", recipientNumber: "51988888888@c.us" }));

    expect(transport.texts).toEqual([
      { chatId: "51988888888@s.whatsapp.net", text: "hola" },
    ]);
  });

  test.each(["120363000000000000@g.us", "51988888888-1600000000@g.us"])(
    "sends to the group jid %s unchanged",
    async (groupJid) => {
      const { transport, handle } = setup();

      const response = await handle(
        post({ text: "hola", recipientNumber: groupJid })
      );

      expect(response.status).toBe(200);
      expect(transport.texts).toEqual([{ chatId: groupJid, text: "hola" }]);
    }
  );

  test("sends to the owner when no number is given", async () => {
    const { transport, handle } = setup();

    const response = await handle(post({ text: "hola" }));

    expect(response.status).toBe(200);
    expect(transport.texts).toEqual([
      { chatId: `${OWNER_PHONE}@s.whatsapp.net`, text: "hola" },
    ]);
  });

  test.each([
    ["no text", { recipientNumber: "51988888888" }],
    ["empty text", { text: "" }],
    ["non-string text", { text: 5 }],
    ["a number that is not digits", { text: "hola", recipientNumber: "abc" }],
    ["a number that is too short", { text: "hola", recipientNumber: "12345" }],
    ["a number that is not a string", { text: "hola", recipientNumber: 5 }],
    [
      "a jid of an unknown kind",
      { text: "hola", recipientNumber: "51988888888@broadcast" },
    ],
    [
      "a user jid with letters",
      { text: "hola", recipientNumber: "abc@s.whatsapp.net" },
    ],
    [
      "a group jid with letters",
      { text: "hola", recipientNumber: "team@g.us" },
    ],
    [
      "a jid with text around it",
      { text: "hola", recipientNumber: " 12036300000000@g.us;" },
    ],
    ["a non-object body", "[1,2]"],
    ["a body that is not JSON", "{oops"],
  ])("rejects %s and sends nothing", async (_name, body) => {
    const { transport, handle } = setup();

    const response = await handle(post(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: "invalid request" });
    expect(transport.texts).toEqual([]);
  });

  test("answers 500 and logs when the send fails", async () => {
    const { transport, handle, entries } = setup();
    transport.failNextSends(1);

    const response = await handle(post({ text: "hola" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: "error" });
    expect(entries).toEqual([
      {
        level: "error",
        message: "Could not send the requested message",
        metadata: { error: "connection closed" },
      },
    ]);
  });

  test("answers 405 for other methods and 404 for other paths", async () => {
    const { transport, handle } = setup();

    const get = await handle(new Request("http://bot.local/send-message"));
    const other = await handle(post({ text: "hola" }, "/other"));

    expect(get.status).toBe(405);
    expect(other.status).toBe(404);
    expect(transport.texts).toEqual([]);
  });
});

describe("notify server", () => {
  let stopServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await stopServer?.();
    stopServer = undefined;
  });

  test("serves the handler on a local port until it is stopped", async () => {
    const { transport, handle } = setup();
    const server = createNotifyServer(handle, "127.0.0.1", 0);
    stopServer = () => server.stop();

    const port = server.start();
    const response = await fetch(`http://127.0.0.1:${port}/send-message`, {
      method: "POST",
      body: JSON.stringify({ text: "hola" }),
    });

    expect(response.status).toBe(200);
    expect(transport.texts).toHaveLength(1);

    await server.stop();
    await expect(
      fetch(`http://127.0.0.1:${port}/send-message`, { method: "POST" })
    ).rejects.toBeInstanceOf(Error);
  });

  test("stopping a server that never started is fine", async () => {
    const { handle } = setup();

    await expect(
      createNotifyServer(handle, "127.0.0.1", 6000).stop()
    ).resolves.toBeUndefined();
  });
});
