// Usage:
//   bun drive-download.ts "<drive-url-or-file-id>" [output-path]

import { createWriteStream, unlinkSync } from "fs";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

function getFileId(input: string): string {
  const m = input.match(/[-\w]{25,}/);
  if (!m) throw new Error("Invalid Google Drive URL or file id");
  return m[0];
}

function buildUrl(fileId: string) {
  const u = new URL("https://drive.google.com/uc");
  u.searchParams.set("export", "download");
  u.searchParams.set("id", fileId);
  return u.toString();
}

function inferFilename(res: Response, fileId: string, explicit?: string): string {
  if (explicit) return explicit;

  const disp = res.headers.get("content-disposition");
  const m = disp?.match(/filename="?([^"]+)"?/i);
  if (m) return m[1];

  return fileId;
}

async function enforceSizeHeader(res: Response) {
  const len = res.headers.get("content-length");
  if (!len) return;

  const n = Number(len);
  if (!Number.isNaN(n) && n > MAX_FILE_SIZE) {
    throw new Error("File too large");
  }
}

async function streamToDisk(res: Response, dest: string) {
  if (!res.body) throw new Error("No body");

  const file = createWriteStream(dest);
  const reader = res.body.getReader();

  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;
      if (total > MAX_FILE_SIZE) {
        file.close();
        unlinkSync(dest);
        throw new Error("File too large");
      }

      if (!file.write(Buffer.from(value))) {
        await new Promise<void>((r) => file.once("drain", r));
      }
    }

    file.end();
  } catch (e) {
    try { file.close(); unlinkSync(dest); } catch {}
    throw e;
  }
}

// Try to get the real binary file if Drive gave an HTML "confirm" page.
async function maybeFollowConfirm(res: Response): Promise<Response> {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return res;

  const html = await res.text();

  // 1) <a href="...confirm=...">
  const a = html.match(/href="([^"]+?confirm=[^"]+?)"/i);
  if (a) {
    const link = a[1].replace(/&amp;/g, "&");
    const url = link.startsWith("http")
      ? link
      : `https://drive.google.com${link}`;
    const r2 = await fetch(url);
    if (!r2.ok) throw new Error("Confirm failed");
    return r2;
  }

  // 2) <form action="..."> with hidden inputs
  const form = html.match(/<form[^>]*action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/i);
  if (form) {
    const action = form[1];
    const inner = form[2];

    const inputs = [...inner.matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi)]
      .reduce<Record<string, string>>((acc, m) => {
        acc[m[1]] = m[2];
        return acc;
      }, {});

    if (inputs.confirm) {
      const base = action.startsWith("http")
        ? new URL(action)
        : new URL(action, "https://drive.google.com");

      for (const [k, v] of Object.entries(inputs)) {
        base.searchParams.set(k, v);
      }

      const r2 = await fetch(base.toString());
      if (!r2.ok) throw new Error("Confirm failed");
      return r2;
    }
  }

  throw new Error("No confirm link found");
}

async function download(source: string, out?: string) {
  const fileId = getFileId(source);
  const initial = await fetch(buildUrl(fileId));
  if (!initial.ok) throw new Error("Fetch failed");

  const res = await maybeFollowConfirm(initial);
  await enforceSizeHeader(res);

  const filename = inferFilename(res, fileId, out);
  await streamToDisk(res, filename);

  return filename;
}

async function main() {
  const [, , src, out] = process.argv;
  if (!src) {
    console.error("Usage: bun drive-download.ts <file-id|url> [output]");
    process.exit(1);
  }

  try {
    const saved = await download(src, out);
    console.log(saved);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

await main();
