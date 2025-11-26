const {
  getRandomPost,
  getPostMetadata,
  generateCaption,
} = require("../services/reddit");
const { getMedia } = require("../services/media-downloader");

async function handleRedditCommand(args) {
  try {
    let post;
    if (args[1].startsWith("http")) {
      post = await getPostMetadata(args[1]);
    } else {
      const subreddit = args[1];
      const timeframe = args[2] || "week";
      const validTimeframes = ["day", "week", "month", "year", "all"];

      if (!validTimeframes.includes(timeframe)) {
        return {
          success: false,
          error:
            "Período de tiempo inválido. Usa day, week, month, year o all.",
        };
      }

      post = await getRandomPost(subreddit, timeframe);
    }

    if (!post) {
      return {
        success: false,
        error: "No se pudo encontrar el subreddit o el post especificado.",
      };
    }
    const media = await getMedia(post.permalink);
    const caption = generateCaption(post);

    return {
      success: true,
      data: {
        caption,
        media,
      },
    };
  } catch (error) {
    console.error("Error in Reddit command:", error);
    return {
      success: false,
      error: "Ha ocurrido un error. Inténtalo de nuevo ahora o más tarde.",
    };
  }
}

module.exports = { handleRedditCommand };
