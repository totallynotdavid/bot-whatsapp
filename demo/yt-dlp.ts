// Usage:
//   bun yt-dlp-demo.ts <youtube-url>          # audio (OGG), only if duration <= 10 min
//   bun yt-dlp-demo.ts video <youtube-url>    # video (MP4, <= 16 MB), only if duration <= 5 min

import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

type Mode = "audio" | "video";

const MAX_AUDIO_SECONDS = 10 * 60; // 10 minutes
const MAX_VIDEO_SECONDS = 5 * 60; // 5 minutes
const MAX_VIDEO_SIZE = "16M"; // ~16 MB

async function main() {
  const args = process.argv.slice(2);

  let mode: Mode = "audio";
  let url: string | undefined;

  if (args[0] === "audio" || args[0] === "video") {
    mode = args[0];
    url = args[1];
  } else {
    url = args[0];
  }

  if (!url) {
    console.error("Usage: bun yt-dlp-demo.ts [audio|video] <youtube-url>");
    process.exit(1);
  }

  try {
    const info = await getVideoInfo(url);
    const duration = info.duration ?? 0;

    if (!info.id || !duration) {
      console.error("Could not get video metadata (id/duration).");
      process.exit(1);
    }

    if (mode === "audio" && duration > MAX_AUDIO_SECONDS) {
      console.error(
        `Audio too long (${formatMinutes(duration)}). Max is ${formatMinutes(
          MAX_AUDIO_SECONDS,
        )}.`,
      );
      process.exit(1);
    }

    if (mode === "video" && duration > MAX_VIDEO_SECONDS) {
      console.error(
        `Video too long (${formatMinutes(duration)}). Max is ${formatMinutes(
          MAX_VIDEO_SECONDS,
        )}.`,
      );
      process.exit(1);
    }

    const outputPath = await downloadWithYtDlp(url, mode, info.id);

    console.log(info.title ?? "(no title)");
    console.log(`Duration: ${formatMinutes(duration)}`);
    console.log("Saved to:", outputPath);
  } catch (err) {
    console.error("Download failed:", err);
    process.exit(1);
  }
}

// Get id + duration (in seconds) using yt-dlp JSON
async function getVideoInfo(
  url: string,
): Promise<{ id?: string; duration?: number; title?: string }> {
  const { stdout } = await execFileAsync("yt-dlp", [
    "-J",
    "--no-playlist",
    "--skip-download",
    url,
  ]);

  const info = JSON.parse(stdout);
  return {
    id: info.id,
    duration: info.duration,
    title: info.title,
  };
}

// Do not rely on yt-dlp stdout; we control filename via -o
async function downloadWithYtDlp(
  url: string,
  mode: Mode,
  videoId: string,
): Promise<string> {
  const isAudio = mode === "audio";
  const outPath = `${videoId}.${isAudio ? "ogg" : "mp4"}`;

  const commonArgs = [
    "-q",
    "--no-warnings",
    "--no-progress",
    "--no-playlist",
    "-o",
    outPath,
  ];

  const modeArgs = isAudio
    ? [
        "-f",
        "bestaudio/best",
        "-x",
        "--audio-format",
        "vorbis", // produces .ogg
        "--audio-quality",
        "0",
      ]
    : [
        "-f",
        "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]",
        "--max-filesize",
        MAX_VIDEO_SIZE,
      ];

  await execFileAsync("yt-dlp", [...modeArgs, ...commonArgs, url], {
    encoding: "utf8",
  });

  return outPath;
}

function formatMinutes(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")} min`;
}

main();
