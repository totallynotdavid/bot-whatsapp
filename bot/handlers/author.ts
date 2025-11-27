/**
 * Author Search Command Handler
 */

import { searchAuthorRecentPapers } from '../services/semantic-scholar.ts';

/**
 * Format paper list for display
 * @param {Array} papers - List of papers
 * @returns {string} Formatted text
 */
function formatPaperList(papers) {
  return papers
    .map((paper, index) => {
      let paperInfo = `${index + 1}. *${paper.title}* (${paper.year})`;
      if (paper.doi) {
        paperInfo += ` (DOI: https://doi.org/${paper.doi})`;
      }
      return paperInfo;
    })
    .join('\n\n');
}

/**
 * Execute author command
 *
 * @param {Object} ctx - Command context
 * @param {Object} ctx.parsed - Parsed command information
 * @param {string[]} ctx.parsed.args - Command arguments (author name)
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
      return { text: '¿De qué autor quieres buscar?' };
    }

    const result = await searchAuthorRecentPapers(query);
    if (result.success) {
      const paperList = formatPaperList(result.papers);
      return { text: `Últimos artículos de ${query}:\n\n${paperList}` };
    } else {
      return { text: result.message };
    }
  } catch (err) {
    console.error('Author command error:', err);
    return {
      text: 'Error al buscar los artículos recientes.',
    };
  }
}

export { execute };

