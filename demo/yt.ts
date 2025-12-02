// Usage:
//   bun  demo.ts never gonna give you up
//   bun  demo.ts video never gonna give you up
//   bun  demo.ts playlist lofi hip hop
//   bun  demo.ts channel kurzgesagt
//
// Requires: YOUTUBE_API_KEY=your_key_here

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

type MediaType = "video" | "playlist" | "channel";

async function main() {
  const args = process.argv.slice(2);

  if (!args.length) {
    console.error(
      "Usage:\n" +
        "  bun demo.ts <query>\n" +
        "  bun demo.ts <video|playlist|channel> <query>",
    );
    process.exit(1);
  }

  const apiKey = process.env.YOUTUBE_API_KEY_1;
  if (!apiKey) {
    console.error("Missing YOUTUBE_API_KEY environment variable.");
    process.exit(1);
  }

  let mediaTypeFilter: MediaType | undefined;
  if (["video", "playlist", "channel"].includes(args[0])) {
    mediaTypeFilter = args.shift() as MediaType;
  }

  const query = args.join(" ").trim();
  if (!query) {
    console.error("Please provide a search query.");
    process.exit(1);
  }

  const params = new URLSearchParams({
    key: apiKey,
    part: "snippet",
    maxResults: "1",
    q: query,
    type: mediaTypeFilter ?? "video,playlist,channel",
  });

  try {
    const response = await fetch(`${YOUTUBE_SEARCH_URL}?${params.toString()}`);
    if (!response.ok) {
      console.error("YouTube API error:", response.status, response.statusText);
      process.exit(1);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      console.error(`No results found for "${query}".`);
      process.exit(1);
    }

    const item = data.items[0];

    const mediaType = detectMediaType(item);
    const id = extractId(item);

    if (!mediaType || !id) {
      console.error("Could not determine media type or ID from result.");
      process.exit(1);
    }

    const snippet = item.snippet ?? {};
    const url = buildUrl(mediaType, id);

    // Best thumbnail: for videos we can always build maxres URL directly
    let thumbnailUrl: string | undefined;
    if (mediaType === "video") {
      thumbnailUrl = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
    } else {
      // For playlists/channels just use whatever default thumbnail the API gives us (if any)
      thumbnailUrl = snippet.thumbnails?.high?.url;
    }

    console.log(snippet.title || "(no title)");
    console.log(`${mediaType} • ${snippet.channelTitle || "(no channel)"}\n`);
    console.log(url);

    if (thumbnailUrl) {
      console.log(`\nThumbnail: ${thumbnailUrl}`);
    }

    if (snippet.description) {
      console.log("\nDescription:\n");
      console.log(snippet.description.trim());
    }
  } catch (err) {
    console.error("Error calling YouTube API:", err);
    process.exit(1);
  }
}

function detectMediaType(item: any): MediaType | null {
  const kind = item.id?.kind as string | undefined;
  if (kind === "youtube#video") return "video";
  if (kind === "youtube#playlist") return "playlist";
  if (kind === "youtube#channel") return "channel";

  if (item.id?.videoId) return "video";
  if (item.id?.playlistId) return "playlist";
  if (item.id?.channelId) return "channel";

  return null;
}

function extractId(item: any): string | null {
  return item.id?.videoId || item.id?.playlistId || item.id?.channelId || null;
}

function buildUrl(mediaType: MediaType, id: string): string {
  switch (mediaType) {
    case "video":
      return `https://www.youtube.com/watch?v=${id}`;
    case "playlist":
      return `https://www.youtube.com/playlist?list=${id}`;
    case "channel":
      return `https://www.youtube.com/channel/${id}`;
  }
}

main();
