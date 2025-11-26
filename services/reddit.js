const fetch = require("node-fetch");
const API_BASE = "https://www.reddit.com/r";

async function getRandomPost(subreddit, timeframe = "week") {
  try {
    const response = await fetch(
      `${API_BASE}/${subreddit}/top.json?t=${timeframe}&limit=100`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const posts = data.data.children.filter((post) => !post.data.over_18);

    if (posts.length === 0) {
      throw new Error(`No se encontraron publicaciones en r/${subreddit}`);
    }

    const randomPost = posts[Math.floor(Math.random() * posts.length)].data;
    return {
      title: randomPost.title,
      author: randomPost.author,
      subreddit: randomPost.subreddit,
      score: randomPost.score,
      num_comments: randomPost.num_comments,
      permalink: `https://reddit.com${randomPost.permalink}`,
      url: randomPost.url,
      timeframe: timeframe,
      selftext: randomPost.selftext,
    };
  } catch (error) {
    console.error("Error fetching from Reddit:", error);
    throw error;
  }
}

async function getPostMetadata(url) {
  try {
    const apiUrl = `${url.replace(/\/$/, "")}.json`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const post = data[0].data.children[0].data;

    return {
      title: post.title,
      author: post.author,
      subreddit: post.subreddit,
      score: post.score,
      num_comments: post.num_comments,
      permalink: `https://reddit.com${post.permalink}`,
      url: post.url,
      selftext: post.selftext,
    };
  } catch (error) {
    console.error("Error fetching post metadata:", error);
    throw error;
  }
}

function generateCaption(post) {
  const {
    title,
    author,
    subreddit,
    score,
    num_comments,
    permalink,
    timeframe,
    selftext,
  } = post;
  const displayTitle = title ? title.trim() : "Publicación sin título";
  let caption = `*${displayTitle}*\n\nPublicado por u/${author} en r/${subreddit}\n👍 ${score} | 💬 ${num_comments}\n`;

  if (timeframe) {
    caption += `Periodo: ${timeframe}\n`;
  }

  if (selftext) {
    const truncatedText =
      selftext.length > 100 ? selftext.substring(0, 97) + "..." : selftext;
    caption += `\n${truncatedText}\n`;
  }

  caption += `\n${permalink}`;
  return caption;
}

module.exports = { getRandomPost, getPostMetadata, generateCaption };
