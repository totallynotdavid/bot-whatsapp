import { describe, expect, test } from "vitest";
import { connect, watchClient } from "../src/client";
import { WwebjsTransport } from "../src/transport";
import { FakeWwebjsClient, recordingLogger, silentLogger } from "./fixtures";

const QR = "2@secret-pairing-payload,abc,def";

describe("whatsapp-web.js pairing QR", () => {
  test("hands the payload to onQr and logs only the event name", () => {
    const client = new FakeWwebjsClient();
    const { logger, entries } = recordingLogger();
    const received: string[] = [];

    watchClient(client.asClient(), logger, (qr) => received.push(qr));
    client.emit("qr", QR);

    expect(received).toEqual([QR]);
    expect(entries).toEqual([
      expect.objectContaining({
        metadata: { event: "whatsapp_qr_generated" },
      }),
    ]);
    expect(JSON.stringify(entries)).not.toContain("secret-pairing-payload");
  });

  test("a failing onQr is logged without the payload", () => {
    const client = new FakeWwebjsClient();
    const { logger, entries } = recordingLogger();

    watchClient(client.asClient(), logger, (qr) => {
      throw new Error(`cannot draw ${qr}`);
    });

    expect(() => client.emit("qr", QR)).not.toThrow();
    expect(entries.map((entry) => entry.metadata?.["event"])).toContain(
      "whatsapp_qr_failed"
    );
    expect(JSON.stringify(entries)).not.toContain("secret-pairing-payload");
  });

  test("works without an onQr", () => {
    const client = new FakeWwebjsClient();

    watchClient(client.asClient(), silentLogger);

    expect(() => client.emit("qr", QR)).not.toThrow();
  });
});

describe("whatsapp-web.js connect", () => {
  test("resolves once the client is ready", async () => {
    const client = new FakeWwebjsClient();

    await expect(connect(client.asClient())).resolves.toBeUndefined();
  });

  test("rejects when the login is rejected instead of waiting for a ready that never comes", async () => {
    const client = new FakeWwebjsClient();
    client.rejectLogin();

    await expect(connect(client.asClient())).rejects.toThrow(
      "WhatsApp authentication failed: session rejected"
    );
  });

  test("rejects when the client disconnects before it is ready", async () => {
    const client = new FakeWwebjsClient();
    client.dropDuringStartup();

    await expect(connect(client.asClient())).rejects.toThrow(
      "WhatsApp disconnected: NAVIGATION"
    );
  });
});

describe("whatsapp-web.js transport startup", () => {
  test("a disconnect before connect() resolves rejects connect() and does not reach onClose", async () => {
    const client = new FakeWwebjsClient();
    client.dropDuringStartup();
    const transport = new WwebjsTransport(client.asClient(), silentLogger);
    const closed: Error[] = [];
    transport.onClose((error) => closed.push(error));

    await expect(transport.connect()).rejects.toThrow(
      "WhatsApp disconnected: NAVIGATION"
    );

    expect(closed).toEqual([]);
  });

  test("a disconnect after connect() resolved reaches onClose", async () => {
    const client = new FakeWwebjsClient();
    const transport = new WwebjsTransport(client.asClient(), silentLogger);
    const closed: Error[] = [];
    transport.onClose((error) => closed.push(error));
    await transport.connect();

    client.emit("disconnected", "LOGOUT");

    expect(closed.map((error) => error.message)).toEqual([
      "WhatsApp disconnected: LOGOUT",
    ]);
  });
});
