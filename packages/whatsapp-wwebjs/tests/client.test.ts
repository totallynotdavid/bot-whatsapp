import { describe, expect, test } from "vitest";
import { watchClient } from "../src/client";
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
