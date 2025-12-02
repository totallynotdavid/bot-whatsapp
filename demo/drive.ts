// Usage:
//   bun drive-download.ts "<drive-url-or-file-id>" [output-path]
//
// Examples:
//   bun drive-download.ts "https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
//   bun drive-download.ts FILE_ID ./my-file.pdf

type FileId = string;

function extractFileId(input: string): FileId {
  // Matches the usual 25+ char Drive IDs.
  const match = input.match(/[-\w]{25,}/);
  if (!match) {
    throw new Error(`Could not find a Google Drive file ID in: ${input}`);
  }
  return match[0];
}

/**
 * Construct a simple public download URL for a Drive file.
 * Works for files that are shared with "Anyone with the link".
 */
function buildDownloadUrl(fileId: FileId): string {
  const url = new URL("https://drive.google.com/uc");
  url.searchParams.set("export", "download");
  url.searchParams.set("id", fileId);
  return url.toString();
}

function inferFilenameFromHeaders(headers: Headers): string | undefined {
  const disposition = headers.get("content-disposition");
  if (!disposition) return undefined;

  // filename* (RFC 5987)
  const filenameStarMatch = disposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (filenameStarMatch?.[1]) {
    return decodeURIComponent(filenameStarMatch[1].replace(/['"]/g, "").trim());
  }

  // filename=
  const filenameMatch = disposition.match(/filename=([^;]+)/i);
  if (filenameMatch?.[1]) {
    return filenameMatch[1].replace(/['"]/g, "").trim();
  }

  return undefined;
}

/**
 * Decide where to save the file:
 *   - if user provided an explicit path, use that
 *   - otherwise, use the filename from headers or fall back to "<fileId>.bin"
 */
function resolveOutputPath(
  explicitPath: string | undefined,
  headers: Headers,
  fileId: FileId
): string {
  if (explicitPath) return explicitPath;

  const inferredName = inferFilenameFromHeaders(headers);
  return inferredName || `${fileId}.bin`;
}

function parseCliArguments(argv: string[]) {
  const [, , source, outputPath] = argv;

  if (!source) {
    throw new Error(
      [
        "Usage:",
        '  bun drive-download.ts "<drive-url-or-file-id>" [output-path]',
        "",
        "Examples:",
        '  bun drive-download.ts "https://drive.google.com/file/d/FILE_ID/view?usp=sharing"',
        "  bun drive-download.ts FILE_ID ./downloaded.pdf",
      ].join("\n")
    );
  }

  return { source, outputPath };
}

async function downloadDriveFile(source: string, outputPathArg?: string) {
  const fileId = extractFileId(source);
  const downloadUrl = buildDownloadUrl(fileId);

  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(
      `Download failed: ${response.status} ${response.statusText}`
    );
  }

  const outputPath = resolveOutputPath(outputPathArg, response.headers, fileId);

  await Bun.write(outputPath, response);

  return outputPath;
}

async function main() {
  try {
    const { source, outputPath } = parseCliArguments(process.argv);
    const savedPath = await downloadDriveFile(source, outputPath);
    console.log(savedPath);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error while downloading.";
    console.error(message);
    process.exit(1);
  }
}

await main();
