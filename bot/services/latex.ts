/**
 * LaTeX Compilation Service
 *
 * Compiles LaTeX code to PNG images using pdflatex and ImageMagick.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import {
  createTempDirectory,
  saveContentToFile,
  cleanupDirectory,
} from '../../utils/file-utils.ts';

const execFilePromise = promisify(execFile);

const LATEX_TEMPLATE = `
\\documentclass[preview,border=2pt,convert={density=300,outext=.png}]{standalone}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{physics}
\\usepackage{bm}
\\begin{document}
\\begin{align*}
%s
\\end{align*}
\\end{document}
`;

/**
 * Creates LaTeX compilation service
 * @returns {Object} LaTeX service
 */
function createLatexService() {
  /**
   * Compiles LaTeX code to PNG image
   * @param {string} latexCode - LaTeX code to compile
   * @returns {Promise<string>} Path to generated PNG file
   */
  async function compileToImage(latexCode) {
    const tempDir = await createTempDirectory();
    const inputPath = `${tempDir}/input.tex`;
    const pdfPath = `${tempDir}/output.pdf`;
    const pngPath = `${tempDir}/output.png`;

    try {
      // Validate LaTeX code
      if (!latexCode || typeof latexCode !== 'string') {
        throw new Error('Invalid LaTeX code provided');
      }

      // Check for forbidden constructs
      const beginRegex = /\\begin\{[a-z]*\}/gi;
      if (beginRegex.test(latexCode)) {
        throw new Error('No uses \\begin{document} ni \\end{document}. No hacen falta.');
      }

      // Create LaTeX document
      const latexDocument = LATEX_TEMPLATE.replace('%s', latexCode);
      await saveContentToFile(latexDocument, inputPath);

      // Compile to PDF
      await execFilePromise('pdflatex', [
        `-output-directory=${tempDir}`,
        '-jobname=output',
        inputPath,
      ]);

      // Convert PDF to PNG
      const convertCommand = platform() === 'win32' ? 'magick' : 'convert';
      const args = [
        '-density',
        '300',
        '-trim',
        '-background',
        'white',
        '-gravity',
        'center',
        '-extent',
        '120%x180%',
        '-alpha',
        'remove',
        pdfPath,
        '-quality',
        '100',
        '-define',
        'png:color-type=2',
        pngPath,
      ];

      if (platform() === 'win32') {
        await execFilePromise('magick', ['convert', ...args]);
      } else {
        await execFilePromise(convertCommand, args);
      }

      return pngPath;
    } catch (error) {
      // Clean up on error
      await cleanupDirectory(tempDir);
      throw error;
    }
  }

  return {
    compileToImage,
  };
}

export { createLatexService };

