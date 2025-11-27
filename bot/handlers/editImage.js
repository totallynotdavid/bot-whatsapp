/**
 * Edit Image Command Handler
 */

import { unlink } from 'fs/promises';
import { editImage, deleteImgurImages } from '../services/edit-image.js';

/**
 * Cleanup timeout in milliseconds (30 seconds)
 */
const CLEANUP_TIMEOUT = 30000;

/**
 * Execute editImage command
 *
 * @param {Object} ctx - Command context
 * @param {Object} ctx.parsed - Parsed command information
 * @param {string[]} ctx.parsed.args - Command arguments
 * @param {Object} ctx.client - WhatsApp client
 * @param {Object} ctx.config - Configuration
 * @returns {Promise<{text?: string, media?: Object}>} Command result
 */
async function execute(ctx) {
  try {
    const { parsed, client } = ctx;
    const { args } = parsed;

    if (args.length === 0) {
      return { text: '¿Qué tipo de edición quieres hacer? Usa !editImage <tipo> @usuario' };
    }

    const result = await editImage(args, client);

    // Schedule cleanup
    setTimeout(async () => {
      try {
        await unlink(result.filePath);
        if (result.deleteHashes && result.deleteHashes.length > 0) {
          await deleteImgurImages(result.deleteHashes);
        }
      } catch (error) {
        console.error('Error cleaning up edit image files:', error);
      }
    }, CLEANUP_TIMEOUT);

    return {
      media: {
        path: result.filePath,
        type: result.isGif ? 'video' : 'image',
        caption: 'Hey, aquí está la imagen editada.',
        gif: result.isGif,
      },
    };
  } catch (err) {
    console.error('Edit image command error:', err);
    return {
      text: `Algo no salió bien. ¿Estás seguro de que usaste el comando correctamente? ${err.message}`,
    };
  }
}

export { execute };