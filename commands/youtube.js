const path = require(`path`);
require(`dotenv`).config({ path: path.resolve(__dirname, `../.env`) });

const { robotEmoji } = require(`../functions/globals`);
const { getVideoLength } = require(`yt_duration`);
const ytdlp_video_processor = require(`ytdlp_video_processor`);
const fetchYoutubeMetadata = require(`yt_metadata`);
const utilities = require(`./utilities`);

// Search on Youtube
async function searchOnYoutube(query, mode) {
  try {
    const media_metadata = await fetchYoutubeMetadata(query, mode);
    let caption;

    if (!media_metadata || Object.keys(media_metadata).length === 0) {
      return {
        error: true,
        message: `${robotEmoji} Houston, tenemos un problema. No se pudo encontrar el video.`,
      };
    }

    const {
      thumbnailUrl,
      title,
      channelTitle,
      viewCount,
      likeCount,
      mediaType,
      mediaId,
    } = media_metadata;

    let baseYoutubeUrl;
    switch (mediaType) {
      case `video`:
        baseYoutubeUrl = `https://youtu.be/${mediaId}`;
        caption = `🎬: ${title}\n📺: ${channelTitle}${
          viewCount ? `\n👀: ${utilities.formatNumber(viewCount)} vistas` : ``
        }${
          likeCount
            ? `\n👍: ${utilities.formatNumber(likeCount)} me gustas`
            : ``
        }\n🔗: ${baseYoutubeUrl}`;
        break;
      case `playlist`:
        baseYoutubeUrl = `https://www.youtube.com/playlist?list=${mediaId}`;
        caption = `🎬: ${title}\n🔗: ${baseYoutubeUrl}`;
        break;
      case `channel`:
        baseYoutubeUrl = `https://www.youtube.com/channel/${mediaId}`;
        caption = `📺: ${channelTitle}\n🔗: ${baseYoutubeUrl}`;
        break;
      default:
        return {
          error: true,
          message: `${robotEmoji} Tipo de medio no reconocido. No se pudo procesar el video.`,
        };
    }

    return { error: false, thumbnailUrl, caption };
  } catch (error) {
    console.error(`Error in searchOnYoutube: ${error.message}`);
    return {
      error: true,
      message: `${robotEmoji} Hubo un problema al procesar el comando.`,
    };
  }
}

async function sendYoutubeAudio(youtubeURL) {
  try {
    if (!youtubeURL) {
      return {
        error: true,
        message: `Oe, pero incluye lo que deseas escuchar.`,
      };
    }

    const media_metadata = await fetchYoutubeMetadata(youtubeURL, `fullData`);

    if (!media_metadata || !media_metadata.mediaId) {
      return { error: true, message: `La URL no es válida.` };
    }

    const videoID = media_metadata.mediaId;
    const videoLength = await getVideoLength(videoID, `seconds`);

    if (videoLength > 600) {
      return {
        error: true,
        message: `El límite de duración de audio es de 10 minutos.`,
      };
    }

    const downloadedMedia = await ytdlp_video_processor(videoID);

    if (
      !downloadedMedia ||
      downloadedMedia.length === 0 ||
      !downloadedMedia[0].path
    ) {
      return { error: true, message: `No se pudo descargar el audio.` };
    }

    const downloadedFilename = downloadedMedia[0].path;

    return {
      error: false,
      filePath: downloadedFilename,
      videoMetadata: {
        title: media_metadata.title,
        channelTitle: media_metadata.channelTitle,
      },
    };
  } catch (error) {
    console.error(`Error in sendYoutubeAudio: ${error.message}`);
    return { error: true, message: error.message };
  }
}

async function sendYoutubeVideo(youtubeURL) {
  try {
    if (!youtubeURL) {
      return {
        error: true,
        message: `Oe, pero incluye lo que deseas ver.`,
      };
    }

    const media_metadata = await fetchYoutubeMetadata(youtubeURL, `idOnly`);

    if (!media_metadata || !media_metadata.mediaId) {
      return { error: true, message: `La URL no es válida.` };
    }

    const videoID = media_metadata.mediaId;

    const videoLength = await getVideoLength(videoID, `seconds`);

    if (videoLength > 210) {
      return {
        error: true,
        message: `El límite de duración de video es de 3 minutos y medio.`,
      };
    }

    const downloadedMedia = await ytdlp_video_processor(
      videoID,
      undefined,
      undefined,
      `mp4`,
      undefined,
      `small`
    );

    if (
      !downloadedMedia ||
      downloadedMedia.length === 0 ||
      !downloadedMedia[0].path
    ) {
      return { error: true, message: `No se pudo descargar el video.` };
    }

    const downloadedFilename = downloadedMedia[0].path;
    return { error: false, filePath: downloadedFilename };
  } catch (error) {
    console.error(`Error in downloadFullVideoInBestQuality: ${error.message}`);
    return { error: true, message: error.message };
  }
}

module.exports = {
  searchOnYoutube,
  sendYoutubeAudio,
  sendYoutubeVideo,
};
