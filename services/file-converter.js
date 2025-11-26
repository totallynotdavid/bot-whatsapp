const ffmpeg = require("fluent-ffmpeg");
const {
  fetchAndSaveFile,
  readFileAsBase64,
  cleanupTempFiles,
} = require("../utils/file-utils");

const config = require("../config");
const { TEMP_DIR } = config;

async function convertGifToMp4(gifUrl) {
  const gifPath = await fetchAndSaveFile(gifUrl, "gif");
  const mp4Path = `${TEMP_DIR}/${Date.now()}_temp.mp4`;

  try {
    await convertWithFfmpeg(gifPath, mp4Path);
    const base64Mp4 = await readFileAsBase64(mp4Path);
    await cleanupTempFiles([gifPath, mp4Path]);
    return `data:video/mp4;base64,${base64Mp4}`;
  } catch (error) {
    console.error("Error converting GIF to MP4:", error);
    await cleanupTempFiles([gifPath, mp4Path]);
    return null;
  }
}

function convertWithFfmpeg(input, output) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .outputOptions("-movflags faststart")
      .outputOptions("-pix_fmt yuv420p")
      .outputOptions("-vf scale=trunc(iw/2)*2:trunc(ih/2)*2")
      .toFormat("mp4")
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(output);
  });
}

module.exports = { convertGifToMp4 };
