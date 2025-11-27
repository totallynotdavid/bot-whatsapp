/**
 * Spotify Command Handler
 * 
 * Searches for songs on Spotify and sends audio preview.
 */

import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;
import { unlink } from 'fs/promises';
import { createSpotifyService } from '../services/spotify-api.js';

/**
 * Cleanup timeout in milliseconds (30 seconds)
 */
const CLEANUP_TIMEOUT = 30000;

/**
 * Execute spotify command
 * 
 * @param {Object} ctx - Command context
 * @param {Object} ctx.parsed - Parsed command information
 * @param {string[]} ctx.parsed.args - Command arguments (search query)
 * @param {Object} ctx.client - WhatsApp client
 * @param {Object} ctx.config - Configuration
 * @returns {Promise<{text?: string, media?: Object}>} Command result
 */
async function execute(ctx) {
  try {
    const { parsed, config } = ctx;
    const { args } = parsed;

    // Validate query
    const query = args.join(' ').trim();
    if (!query) {
      return { text: 'Oe, incluye la canción que quieres buscar.' };
    }

    // Check if Spotify is configured
    if (!config.spotifyClientId || !config.spotifyClientSecret) {
      return { text: 'El servicio de Spotify no está configurado.' };
    }

    // Create Spotify service
    const spotify = createSpotifyService(config);

    // Search and download track
    const track = await spotify.searchAndDownload(query);

    if (!track) {
      return { text: 'Lo siento, no pude encontrar la canción que buscas.' };
    }

    // Schedule cleanup
    setTimeout(async () => {
      try {
        await unlink(track.filePath);
      } catch (error) {
        console.error('Error cleaning up Spotify file:', error);
      }
    }, CLEANUP_TIMEOUT);

    // Return media with caption
    return {
      media: {
        path: track.filePath,
        type: 'audio',
        caption: `🎵 *${track.name}* de *${track.artist}*`,
      },
    };
  } catch (err) {
    console.error('Spotify command error:', err);
    return {
      text: 'Tmr, algo salió mal. Intenta de nuevo o más tarde.',
    };
  }
}

export { execute };
