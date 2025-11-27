/**
 * Wikipedia Command Handler
 *
 * Searches Wikipedia for articles and returns summaries with optional images.
 */

import { createWikipediaService } from '../services/wikipedia-api.ts';

/**
 * Execute wikipedia command
 *
 * @param {Object} ctx - Command context
 * @param {Object} ctx.parsed - Parsed command information
 * @param {string[]} ctx.parsed.args - Command arguments
 * @param {Object} ctx.config - Configuration
 * @returns {Promise<{text?: string, media?: Object}>} Command result
 */
async function execute(ctx) {
  try {
    const { parsed, config } = ctx;
    const { args } = parsed;

    // Check if all args are whitespace
    const joinedArgs = args.join(' ').trim();
    if (!joinedArgs) {
      return { text: '🤖 Adjunta un enlace o una búsqueda de Wikipedia.' };
    }

    // Parse language code and query
    let languageCode = 'es';
    let query = joinedArgs;

    // Check if first arg is a 2-letter language code
    if (args.length >= 1 && args[0].length === 2 && /^[a-z]{2}$/.test(args[0])) {
      languageCode = args[0];
      query = args.slice(1).join(' ');
    }

    if (!query.trim()) {
      return { text: '🤖 Asegúrate de usar un código de idioma válido de 2 letras seguido de la búsqueda.' };
    }

    // Create Wikipedia service
    const wikipedia = createWikipediaService(config);

    // Get article
    const article = await wikipedia.getArticle(query.trim(), languageCode);

    if (!article) {
      return { text: `🤖 Tu búsqueda "${query}" no dio resultados.` };
    }

    // Format response
    let responseText = `🤖 *${article.title}*: ${article.extract}`;

    if (article.disambiguationNote) {
      responseText = `🤖 ${article.disambiguationNote}\n\n${responseText}`;
    } else if (article.notFoundNote) {
      responseText = `🤖 ${article.notFoundNote}\n\n${responseText}`;
    }

    // Return with image if available
    if (article.imageUrl) {
      return {
        media: {
          url: article.imageUrl,
          caption: responseText,
        },
      };
    }

    return { text: responseText };
  } catch (err) {
    console.error('Wikipedia command error:', err);
    return {
      text: '🤖 Ha ocurrido un error al consultar Wikipedia. Inténtalo de nuevo.',
    };
  }
}

export { execute };

