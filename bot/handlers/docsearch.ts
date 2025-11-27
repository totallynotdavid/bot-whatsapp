/**
 * Document Search Command Handler
 */

import { searchFolderDatabase } from '../services/gdrive.ts';

/**
 * Execute docsearch command
 *
 * @param {Object} ctx - Command context
 * @param {Object} ctx.parsed - Parsed command information
 * @param {string[]} ctx.parsed.args - Command arguments (search query)
 * @param {Object} ctx.client - WhatsApp client
 * @param {Object} ctx.config - Configuration
 * @returns {Promise<{text?: string}>} Command result
 */
async function execute(ctx) {
  try {
    const { parsed } = ctx;
    const { args } = parsed;

    const query = args.join(' ').trim();
    if (!query) {
      return { text: 'Ya, pero, ¿de qué quieres buscar?' };
    }

    const results = await searchFolderDatabase(query);

    if (results && results.length > 0) {
      let messageText = 'Resultados:\n\n';
      const limit = Math.min(5, results.length);
      for (let i = 0; i < limit; i++) {
        const file = results[i];
        messageText += `${i + 1}. ${file.name} (${file.webViewLink})\n`;
      }
      return { text: messageText };
    } else {
      return { text: 'No se encontraron resultados.' };
    }
  } catch (err) {
    console.error('Docsearch command error:', err);
    return {
      text: 'Error al buscar documentos.',
    };
  }
}

export { execute };

