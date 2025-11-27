/**
 * Reddit API Service
 *
 * Handles Reddit API calls, post fetching, and media downloading.
 */

import fetch from 'node-fetch';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const API_BASE = 'https://www.reddit.com/r';
const FETCH_TIMEOUT = 10000;

/**
 * Fetches URL with timeout
 * @param {string} url - URL to fetch
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Downloads media from URL to temp file
 * @param {string} url - Media URL
 * @returns {Promise<{path: string, type: string}>} File path and type
 */
async function downloadMedia(url) {
  try {
    const response = await fetchWithTimeout(url);
    const buffer = await response.buffer();

    // Determine file extension from URL or content-type
    const contentType = response.headers.get('content-type') || '';
    let extension = 'bin'; // fallback

    if (contentType.startsWith('image/')) {
      if (contentType.includes('gif')) extension = 'gif';
      else if (contentType.includes('png')) extension = 'png';
      else if (contentType.includes('jpg') || contentType.includes('jpeg')) extension = 'jpg';
      else extension = 'png';
    } else if (contentType.startsWith('video/')) {
      if (contentType.includes('mp4')) extension = 'mp4';
      else extension = 'mp4';
    }

    // If URL has extension, use that
    const urlMatch = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
    if (urlMatch) {
      extension = urlMatch[1].toLowerCase();
    }

    const fileName = `reddit_${Date.now()}.${extension}`;
    const filePath = join(tmpdir(), fileName);

    await writeFile(filePath, buffer);

    // Determine media type for WhatsApp
    let type = 'document'; // fallback
    if (contentType.startsWith('image/')) {
      type = 'image';
    } else if (contentType.startsWith('video/')) {
      type = 'video';
    }

    return { path: filePath, type };
  } catch (error) {
    console.error('Error downloading media:', error);
    throw error;
  }
}

/**
 * Fetches random post from subreddit
 * @param {string} subreddit - Subreddit name
 * @param {string} timeframe - Timeframe ('day', 'week', 'month', 'year', 'all')
 * @returns {Promise<Object|null>} Post object or null
 */
async function getRandomPost(subreddit, timeframe = 'week') {
  try {
    const response = await fetchWithTimeout(
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
    console.error('Error fetching from Reddit:', error);
    throw error;
  }
}

/**
 * Fetches post metadata from URL
 * @param {string} url - Reddit post URL
 * @returns {Promise<Object|null>} Post object or null
 */
async function getPostMetadata(url) {
  try {
    const apiUrl = `${url.replace(/\/$/, '')}.json`;
    const response = await fetchWithTimeout(apiUrl);

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
    console.error('Error fetching post metadata:', error);
    throw error;
  }
}

/**
 * Generates caption for post
 * @param {Object} post - Post object
 * @returns {string} Formatted caption
 */
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

  const displayTitle = title ? title.trim() : 'Publicación sin título';
  let caption = `*${displayTitle}*\n\nPublicado por u/${author} en r/${subreddit}\n👍 ${score} | 💬 ${num_comments}\n`;

  if (timeframe) {
    caption += `Periodo: ${timeframe}\n`;
  }

  if (selftext) {
    const truncatedText =
      selftext.length > 100 ? selftext.substring(0, 97) + '...' : selftext;
    caption += `\n${truncatedText}\n`;
  }

  caption += `\n${permalink}`;
  return caption;
}

/**
 * Checks if URL is a direct media URL (image/video)
 * @param {string} url - URL to check
 * @returns {boolean} True if direct media URL
 */
function isDirectMediaUrl(url) {
  const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm', '.mov'];
  return mediaExtensions.some(ext => url.toLowerCase().includes(ext));
}

export {
  getRandomPost,
  getPostMetadata,
  generateCaption,
  downloadMedia,
  isDirectMediaUrl,
};