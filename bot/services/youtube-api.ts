/**
 * YouTube API Service
 *
 * Handles YouTube video search and metadata retrieval.
 */

import fetchYoutubeMetadata from 'yt_metadata';
import fetch from 'node-fetch';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Downloads image from URL to temp file
 * @param {string} url - Image URL
 * @param {string} fileName - Destination filename
 * @returns {Promise<string>} File path
 */
async function downloadImage(url, fileName) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    const filePath = join(tmpdir(), fileName);
    await writeFile(filePath, buffer);
    return filePath;
  } catch (error) {
    console.error('Error downloading image:', error);
    throw error;
  }
}

/**
 * Creates YouTube API service
 * @returns {Object} YouTube service
 */
function createYouTubeService() {
  /**
   * Searches for video on YouTube
   * @param {string} query - Search query
   * @returns {Promise<Object|null>} Video metadata or null
   */
  async function searchVideo(query) {
    try {
      const metadata = await fetchYoutubeMetadata(query, 'fullData');

      if (!metadata || Object.keys(metadata).length === 0) {
        return null;
      }

      const {
        thumbnailUrl,
        title,
        channelTitle,
        viewCount,
        likeCount,
        mediaType,
        mediaId,
      } = metadata;

      let baseUrl;
      let caption;

      switch (mediaType) {
        case 'video':
          baseUrl = `https://youtu.be/${mediaId}`;
          caption = `🎬: ${title}\n📺: ${channelTitle}${viewCount ? `\n👀: ${formatNumber(viewCount)} vistas` : ''}${likeCount ? `\n👍: ${formatNumber(likeCount)} me gustas` : ''}\n🔗: ${baseUrl}`;
          break;
        case 'playlist':
          baseUrl = `https://www.youtube.com/playlist?list=${mediaId}`;
          caption = `🎬: ${title}\n🔗: ${baseUrl}`;
          break;
        case 'channel':
          baseUrl = `https://www.youtube.com/channel/${mediaId}`;
          caption = `📺: ${channelTitle}\n🔗: ${baseUrl}`;
          break;
        default:
          return null;
      }

      return {
        thumbnailUrl,
        caption,
        mediaType,
      };
    } catch (error) {
      console.error('Error searching YouTube:', error);
      throw error;
    }
  }

  /**
   * Searches for video and downloads thumbnail
   * @param {string} query - Search query
   * @returns {Promise<Object|null>} Video info with thumbnail path or null
   */
  async function searchAndDownloadThumbnail(query) {
    try {
      const videoData = await searchVideo(query);

      if (!videoData) {
        return null;
      }

      const { thumbnailUrl, caption, mediaType } = videoData;

      if (!thumbnailUrl) {
        return { caption };
      }

      // Download thumbnail to temp file
      const fileName = `youtube_thumb_${Date.now()}.jpg`;
      const thumbnailPath = await downloadImage(thumbnailUrl, fileName);

      return {
        thumbnailPath,
        caption,
        mediaType,
      };
    } catch (error) {
      console.error('Error in searchAndDownloadThumbnail:', error);
      throw error;
    }
  }

  return {
    searchVideo,
    searchAndDownloadThumbnail,
  };
}

/**
 * Formats number with spaces for readability
 * @param {number} number - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(number) {
  const parts = [];
  let str = number.toString();
  while (str.length > 3) {
    parts.unshift(str.slice(-3));
    str = str.slice(0, -3);
  }
  if (str.length > 0) {
    parts.unshift(str);
  }
  return parts.join(' ');
}

export { createYouTubeService };

