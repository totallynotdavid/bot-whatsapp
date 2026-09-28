import { randomBytes } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpeg from "fluent-ffmpeg";

// Baileys sends whatever bytes it is given as a sticker, unlike
// whatsapp-web.js, which converts to webp itself (Util.formatToWebpSticker,
// image client-side in the browser, video through the same ffmpeg options
// used here). Baileys stickers must be actual webp, so this adapter converts
// before sending: scaled and padded to WhatsApp's 512x512 sticker canvas.
// A still image has no meaningful frame rate to resample (ffmpeg's fps
// filter drops every frame of a source with no known duration), so fps is
// applied only for animated media, capped at 10fps and 5 seconds like
// whatsapp-web.js's own conversion.
const STICKER_FILTER =
  "scale='iw*min(512/iw,512/ih)':'ih*min(512/iw,512/ih)',format=rgba,pad=512:512:'(512-iw)/2':'(512-ih)/2':'#00000000',setsar=1";

export async function convertToWebpSticker(
  filePath: string,
  isAnimated: boolean
): Promise<Buffer> {
  const outputPath = join(tmpdir(), `${randomBytes(6).toString("hex")}.webp`);

  await new Promise<void>((resolve, reject) => {
    const command = ffmpeg(filePath).addOutputOptions([
      "-vcodec",
      "libwebp",
      "-vf",
      isAnimated ? `${STICKER_FILTER},fps=10` : STICKER_FILTER,
      "-loop",
      "0",
      "-preset",
      "default",
      "-an",
    ]);
    if (isAnimated) {
      command.addOutputOptions(["-t", "00:00:05.0"]);
    } else {
      command.addOutputOptions(["-frames:v", "1"]);
    }
    command
      .toFormat("webp")
      .on("error", reject)
      .on("end", () => resolve())
      .save(outputPath);
  });

  try {
    return await readFile(outputPath);
  } finally {
    await unlink(outputPath).catch(() => {});
  }
}
