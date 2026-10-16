import { describe, expect, it } from "vitest";
import { normalizePhoneNumber } from "../src/message-mapping";

describe("normalizePhoneNumber", () => {
  it("removes the JID suffix", () => {
    expect(normalizePhoneNumber("51955555555@s.whatsapp.net")).toBe(
      "51955555555"
    );
  });

  it("cuts at the first at-sign when a newline follows it", () => {
    expect(normalizePhoneNumber("51955555555@\n123")).toBe("51955555555");
  });

  it("handles the ReDoS input within a time bound", () => {
    const input = "@".repeat(100_000) + "\n";
    const started = Date.now();

    expect(normalizePhoneNumber(input)).toBe("");
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
