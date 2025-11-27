/**
 * YouTube Command Handler
 *
 * Searches for videos on YouTube and returns metadata with thumbnail.
 */

import { createYouTubeService } from '../services/youtube-api.ts';
import { unlink } from 'fs/promises';

/**
 * Cleanup timeout in milliseconds (30 seconds)
 */
const CLEANUP_TIMEOUT = 30000;

/**
 * Execute youtube command
 *
 * @param {Object} ctx - Command context
 * @param {Object} ctx.parsed - Parsed command information
 * @param {string[]} ctx.parsed.args - Command arguments (search query)
 * @returns {Promise<{text?: string, media?: Object}>} Command result
 */
async function execute(ctx) {
  try {
    const { parsed } = ctx;
    const { args } = parsed;

    // Validate query
    const query = args.join(' ').trim();
    if (!query) {
      return { text: 'Oe, incluye lo que quieres buscar en YouTube.' };
    }

    // Create YouTube service
    const youtube = createYouTubeService();

    // Search and download thumbnail
    const result = await youtube.searchAndDownloadThumbnail(query);

    if (!result) {
      return { text: 'Houston, tenemos un problema. No se pudo encontrar el video.' };
    }

    const { thumbnailPath, caption } = result;

    // If no thumbnail, return text only
    if (!thumbnailPath) {
      return { text: caption };
    }

    // Schedule cleanup
    setTimeout(async () => {
      try {
        await unlink(thumbnailPath);
      } catch (error) {
        console.error('Error cleaning up YouTube thumbnail:', error);
      }
    }, CLEANUP_TIMEOUT);

    // Return media with caption
    return {
      media: {
        path: thumbnailPath,
        type: 'image',
        caption,
      },
    };
  } catch (err) {
    console.error('YouTube command error:', err);
    return {
      text: 'Houston, tenemos un problema. Hubo un error al procesar el comando.',
    };
  }
}

export { execute };

