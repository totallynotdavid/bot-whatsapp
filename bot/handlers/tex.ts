/**
 * LaTeX Command Handler
 *
 * Compiles LaTeX code to PNG images and sends them to chat.
 */

import { createLatexService } from '../services/latex.ts';
import { cleanupDirectory } from '../../utils/file-utils.ts';
import { dirname } from 'path';

const CLEANUP_TIMEOUT = 30000;
/**
 * Execute tex command
 *
 * @param {Object} ctx - Command context
 * @param {Object} ctx.parsed - Parsed command information
 * @param {string[]} ctx.parsed.args - Command arguments (LaTeX code)
 * @param {Object} ctx.parsed.sender - Sender information
 * @returns {Promise<{text?: string, media?: Object, error?: string}>} Command result
 */
async function execute(ctx) {
  try {
    const { parsed } = ctx;
    const { args, sender } = parsed;

    // Get LaTeX code from arguments
    const latexCode = args.join(' ').trim();

    if (!latexCode) {
      return { text: 'Falta el código LaTeX.' };
    }

    // Create LaTeX service
    const latex = createLatexService();

    // Compile to image
    const imagePath = await latex.compileToImage(latexCode);

    // Schedule cleanup of the entire temp directory
    setTimeout(async () => {
      try {
        const tempDir = dirname(imagePath);
        await cleanupDirectory(tempDir);
      } catch (error) {
        console.error('Error cleaning up LaTeX temp directory:', error);
      }
    }, CLEANUP_TIMEOUT);

    // Return media with caption
    return {
      media: {
        path: imagePath,
        type: 'image',
        caption: `🤖 Solicitado por ${sender.name}`,
      },
    };
  } catch (err) {
    console.error('LaTeX command error:', err);

    // Return user-friendly error message
    let errorMessage = 'Hubo un error al procesar el código LaTeX.';
    if (err.message.includes('No uses')) {
      errorMessage = err.message;
    }

    return { error: errorMessage };
  }
}

export { execute };

