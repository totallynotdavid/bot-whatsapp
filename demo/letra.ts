// demo.ts
// Usage: bun demo.ts feel it still

const LYRICS_API_BASE_URL = "https://api.lyrics.ovh";

/**
 * Normalize provider formatting:
 * - Convert CRLF to LF
 * - Remove single empty lines (used between every line)
 * - Keep a single empty line for runs of 2+ (real stanza breaks)
 */
function formatLyrics(raw: string): string {
  const normalized = raw.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");

  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() !== "") {
      // Normal lyric line
      result.push(line.trimEnd());
      i++;
      continue;
    }

    // We hit one or more empty lines: count how many in a row
    let j = i;
    while (j < lines.length && lines[j].trim() === "") {
      j++;
    }
    const emptyCount = j - i;

    // If there were 2+ empty lines, treat as a stanza break
    if (emptyCount >= 2 && result.length > 0 && j < lines.length) {
      result.push(""); // exactly one blank line between stanzas
    }

    i = j;
  }

  return result.join("\n").trim();
}

async function main() {
  const searchQuery = process.argv.slice(2).join(" ").trim();

  if (!searchQuery) {
    console.error("Usage: node demo.ts <song name>");
    process.exit(1);
  }

  // 1. Find the first song that matches the search query
  const searchResponse = await fetch(
    `${LYRICS_API_BASE_URL}/suggest/${encodeURIComponent(searchQuery)}`,
  );

  if (!searchResponse.ok) {
    console.error("Search request failed with status:", searchResponse.status);
    process.exit(1);
  }

  const searchData = await searchResponse.json();
  const firstMatch = searchData.data?.[0];

  if (!firstMatch) {
    console.error("No songs found for query:", searchQuery);
    process.exit(1);
  }

  const songTitle = firstMatch.title;
  const artistName = firstMatch.artist.name;

  // 2. Fetch lyrics for that song
  const lyricsResponse = await fetch(
    `${LYRICS_API_BASE_URL}/v1/${encodeURIComponent(
      artistName,
    )}/${encodeURIComponent(songTitle)}`,
  );

  if (!lyricsResponse.ok) {
    console.error("Lyrics request failed with status:", lyricsResponse.status);
    process.exit(1);
  }

  const lyricsData = await lyricsResponse.json();

  if (!lyricsData.lyrics) {
    console.error("Lyrics not found for:", artistName, "-", songTitle);
    process.exit(1);
  }

  const cleanedLyrics = formatLyrics(lyricsData.lyrics);

  console.log(`${songTitle} — ${artistName}\n`);
  console.log(cleanedLyrics);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
