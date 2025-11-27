/**
 * Document Download Command Handler
 */

import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;
import { stat, unlink } from 'fs/promises';
import { downloadFilesFromGoogleDrive } from '../services/gdrive.js';

/**
 * Execute docdown command
 *
 * @param {Object} ctx - Command context
 * @param {Object} ctx.parsed - Parsed command information
 * @param {string[]} ctx.parsed.args - Command arguments (Google Drive link)
 * @param {Object} ctx.client - WhatsApp client
 * @param {Object} ctx.config - Configuration
 * @returns {Promise<{text?: string, media?: Object}>} Command result
 */
async function execute(ctx) {
  try {
    const { parsed, client } = ctx;
    const { args } = parsed;

    if (args.length === 0) {
      return { text: 'Ya, pero, ¿de qué quieres descargar?' };
    }

    if (args.length > 1) {
      return { text: 'Envía solo un enlace de Google Drive.' };
    }

    const query = args[0];
    const filePath = await downloadFilesFromGoogleDrive(query);

    const maxSize = 200 * 1024 * 1024; // 200MB
    const fileStats = await stat(filePath);

    if (fileStats.size > maxSize) {
      await unlink(filePath);
      return { text: 'El archivo es demasiado grande. El tamaño máximo es de 200 MB.' };
    }

    const media = MessageMedia.fromFilePath(filePath);

    // Schedule cleanup
    setTimeout(async () => {
      try {
        await unlink(filePath);
      } catch (error) {
        console.error('Error cleaning up downloaded file:', error);
      }
    }, 30000); // 30 seconds

    return {
      media: {
        path: filePath,
        type: 'document',
        caption: 'Aquí tienes tu archivo.',
      },
    };
  } catch (err) {
    console.error('Docdown command error:', err);
    return {
      text: '¿Seguro de que ese archivo existe?',
    };
  }
}

export { execute };