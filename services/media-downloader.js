const MediaDownloader = require("@totallynodavid/downloader");
const { convertGifToMp4 } = require("./file-converter");

async function getMedia(url) {
  try {
    const media = await MediaDownloader(url);

    if (media.urls.length > 0) {
      const processedUrls = await Promise.all(media.urls.map(processMediaUrl));
      return {
        urls: processedUrls.filter((url) => url !== null),
        count: processedUrls.filter((url) => url !== null).length,
      };
    }

    return media;
  } catch (error) {
    console.error("Error downloading or processing media:", error);
    throw error;
  }
}

async function processMediaUrl(url) {
  if (url.endsWith(".gif")) {
    return await convertGifToMp4(url);
  }
  return url;
}

module.exports = { getMedia };
