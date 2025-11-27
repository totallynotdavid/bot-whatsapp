/**
 * Reddit Command Handler
 *
 * Fetches posts from Reddit and sends media with captions.
 */

import { unlink } from 'fs/promises';
import {
  getRandomPost,
  getPostMetadata,
  generateCaption,
  downloadMedia,
  isDirectMediaUrl,
} from '../services/reddit-api.js';

/**
 * Cleanup timeout in milliseconds (30 seconds)
 */
const CLEANUP_TIMEOUT = 30000;

/**
 * Valid timeframes for Reddit API
 */
const VALID_TIMEFRAMES = ['day', 'week', 'month', 'year', 'all'];

/**
 * Execute reddit command
 *
 * @param {Object} ctx - Command context
 * @param {Object} ctx.parsed - Parsed command information
 * @param {string[]} ctx.parsed.args - Command arguments
 * @returns {Promise<{text?: string, media?: Object}>} Command result
 */
async function execute(ctx) {
  try {
    const { parsed } = ctx;
    const { args } = parsed;

    if (args.length === 0) {
      return {
        text: 'Por favor, proporciona un subreddit o una URL de Reddit.\nEjemplo: /reddit memes o /reddit https://reddit.com/r/...',
      };
    }

    let post;

    // Check if first arg is a URL
    if (args[0].startsWith('http')) {
      const url = args[0];
      post = await getPostMetadata(url);
    } else {
      // Get subreddit and timeframe
      const subreddit = args[0];
      const timeframe = args[1] || 'week';

      if (!VALID_TIMEFRAMES.includes(timeframe)) {
        return {
          text: `Período de tiempo inválido. Usa: ${VALID_TIMEFRAMES.join(', ')}`,
        };
      }

      post = await getRandomPost(subreddit, timeframe);
    }

    if (!post) {
      return {
        text: 'No se pudo encontrar el subreddit o el post especificado.',
      };
    }

    const caption = generateCaption(post);

    // Check if post has direct media
    if (post.url && isDirectMediaUrl(post.url)) {
      try {
        // Download media
        const { path, type } = await downloadMedia(post.url);

        // Schedule cleanup
        setTimeout(async () => {
          try {
            await unlink(path);
          } catch (error) {
            console.error('Error cleaning up Reddit file:', error);
          }
        }, CLEANUP_TIMEOUT);

        // Return media with caption
        return {
          media: {
            path,
            type,
            caption,
          },
        };
      } catch (error) {
        console.error('Error downloading Reddit media:', error);
        // Fall back to text-only response
        return { text: caption };
      }
    } else {
      // Text-only post
      return { text: caption };
    }
  } catch (err) {
    console.error('Reddit command error:', err);
    return {
      text: 'Ha ocurrido un error. Inténtalo de nuevo ahora o más tarde.',
    };
  }
}

export { execute };