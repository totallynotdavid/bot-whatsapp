import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { convertToWebpSticker } from "../src/webp-sticker";

// A minimal valid 1x1 transparent PNG.
const STATIC_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

const dir = mkdtempSync(join(tmpdir(), "webp-sticker-test-"));

describe("convertToWebpSticker", () => {
  test("converts a static image to a valid webp", async () => {
    const pngPath = join(dir, "static.png");
    writeFileSync(pngPath, Buffer.from(STATIC_PNG_BASE64, "base64"));

    const webp = await convertToWebpSticker(pngPath, false);

    expect(isWebp(webp)).toBe(true);
  });

  // Synthesizes a real, tiny mp4 with ffmpeg itself: this converter is only
  // ever exercised against genuine media, never a WhatsApp connection.
  test("converts an animated video to a valid webp", async () => {
    const mp4Path = join(dir, "animated.mp4");
    execFileSync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=red:s=32x32:d=1",
      mp4Path,
    ]);

    const webp = await convertToWebpSticker(mp4Path, true);

    expect(isWebp(webp)).toBe(true);
  });
});
