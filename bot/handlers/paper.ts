/**
 * Paper Search Command Handler
 */

import { searchPapersByKeywords } from '../services/semantic-scholar.ts';

/**
 * Format paper list for display
 * @param {Array} papers - List of papers
 * @returns {string} Formatted text
 */
function formatPaperList(papers) {
  return papers
    .map((paper, index) => {
      let paperInfo = `${index + 1}. *${paper.title}* (${
        paper.year
      }) de _${paper.authors}_`;
      if (paper.journal) {
        paperInfo += ` publicado en ${paper.journal}`;
      }
      if (paper.doi) {
        paperInfo += ` (DOI: https://doi.org/${paper.doi})`;
      }
      return paperInfo;
    })
    .join('\n\n');
}

/**
 * Execute paper command
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
      return { text: '¿De qué tema quieres buscar?' };
    }

    const result = await searchPapersByKeywords(query);
    if (result.success) {
      const paperList = formatPaperList(result.papers);
      return { text: `Resultados:\n\n${paperList}` };
    } else {
      return { text: result.message };
    }
  } catch (err) {
    console.error('Paper command error:', err);
    return {
      text: 'Error al buscar artículos.',
    };
  }
}

export { execute };

