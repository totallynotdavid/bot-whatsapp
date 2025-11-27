/**
 * DOI Command Handler
 *
 * Fetches academic papers by DOI and sends PDF with metadata.
 */

import { unlink } from 'fs/promises';
import { fetchArticle, downloadPdf, getPaperDetails } from '../services/scihub.js';

/**
 * Cleanup timeout in milliseconds (30 seconds)
 */
const CLEANUP_TIMEOUT = 30000;

/**
 * DOI regex pattern
 */
const DOI_PATTERN = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;

/**
 * Execute doi command
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
        text: 'Por favor, proporciona un DOI o término de búsqueda.\nEjemplo: /doi 10.1000/journals.example/article',
      };
    }

    const input = args.join(' ');
    const isDOI = DOI_PATTERN.test(input);

    let paperDetails = null;
    let pdfPath = null;

    // Get paper details if it's a DOI
    if (isDOI) {
      paperDetails = await getPaperDetails(input);
    }

    // Fetch article from Sci-Hub
    const sciHubResult = await fetchArticle(input);

    if (!sciHubResult.pdfLink) {
      return {
        text: 'No se pudo encontrar el PDF del artículo.',
      };
    }

    // Download PDF
    const { path } = await downloadPdf(sciHubResult.pdfLink, input);
    pdfPath = path;

    // Build caption
    let caption = sciHubResult.title
      ? `📄 *Título*: ${sciHubResult.title}\n\n`
      : '';

    if (paperDetails) {
      const { authors, year, abstract } = paperDetails;
      if (authors && authors.length > 0) {
        caption += `*Autor(es)*: ${authors.join(', ')}\n`;
      }
      if (year) {
        caption += `*Año*: ${year}\n`;
      }
      if (abstract) {
        caption += `\n*Resumen*:\n${abstract}`;
      }
    }

    // Schedule cleanup
    setTimeout(async () => {
      try {
        await unlink(pdfPath);
      } catch (error) {
        console.error('Error cleaning up DOI PDF file:', error);
      }
    }, CLEANUP_TIMEOUT);

    // Return media with caption
    return {
      media: {
        path: pdfPath,
        type: 'document',
        caption: caption.trim(),
      },
    };
  } catch (err) {
    console.error('DOI command error:', err);
    return {
      text: `Se ha producido un error al intentar obtener el artículo: ${err.message}`,
    };
  }
}

export { execute };