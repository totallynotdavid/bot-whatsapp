import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import { describe, expect, test } from "vitest";
import { RemoteImageDownloader } from "../src/infrastructure/storage/remote-image-downloader";

function respondWith(body: string, status = 200, contentType?: string) {
  return async () =>
    new Response(body, {
      status,
      headers: contentType ? { "content-type": contentType } : {},
    });
}

describe("RemoteImageDownloader", () => {
  test("saves the image to a temp file and deletes it on dispose", async () => {
    const downloader = new RemoteImageDownloader(
      respondWith("png-bytes", 200, "image/png")
    );

    const image = await downloader.download("https://files.example/a.png");

    expect(readFileSync(image.filePath, "utf8")).toBe("png-bytes");
    expect(extname(image.filePath)).toBe(".png");

    await image.dispose();
    expect(existsSync(image.filePath)).toBe(false);
  });

  test("falls back to .jpg when the content type is unknown", async () => {
    const downloader = new RemoteImageDownloader(respondWith("x"));

    const image = await downloader.download("https://files.example/a");

    expect(extname(image.filePath)).toBe(".jpg");
    await image.dispose();
  });

  test("requests the URL it is given", async () => {
    const urls: string[] = [];
    const downloader = new RemoteImageDownloader(async (input) => {
      urls.push(String(input));
      return new Response("x");
    });

    await (await downloader.download("https://files.example/a.jpg")).dispose();

    expect(urls).toEqual(["https://files.example/a.jpg"]);
  });

  test("fails on an error status", async () => {
    const downloader = new RemoteImageDownloader(respondWith("nope", 404));

    await expect(
      downloader.download("https://files.example/a.jpg")
    ).rejects.toThrow("Download failed with status 404");
  });
});
