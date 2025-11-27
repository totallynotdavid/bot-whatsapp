/**
 * Translate Command Handler
 * 
 * Translates text between languages using Google Translate API.
 * Supports auto-detection and explicit source/target language specification.
 */

import { translateText, parseTranslationArgs } from '../services/translate-api.js';

/**
 * Execute translate command
 * 
 * Formats:
 * - /translate text -> translates to Spanish (default)
 * - /translate en text -> translates to English
 * - /translate es en text -> translates from Spanish to English
 * 
 * @param {Object} ctx - Command context
 * @param {Object} ctx.parsed - Parsed command information
 * @param {string[]} ctx.parsed.args - Command arguments
 * @returns {Promise<{text: string}>} Translation result
 */
async function execute(ctx) {
  try {
    const { parsed } = ctx;
    const { args } = parsed;

    // Validate arguments
    if (args.length === 0) {
      return {
        text: 'Por favor proporciona el texto a traducir.\n\n' +
              'Ejemplos:\n' +
              '• /translate hello world\n' +
              '• /translate en hola mundo\n' +
              '• /translate es en hello world'
      };
    }

    // Parse translation arguments
    const translationParams = parseTranslationArgs(args);

    if (!translationParams || !translationParams.text || translationParams.text.trim().length === 0) {
      return {
        text: 'Por favor proporciona el texto a traducir después del código de idioma.'
      };
    }

    const { sourceLang, targetLang, text: textToTranslate } = translationParams;

    // Perform translation
    const translatedText = await translateText(textToTranslate, targetLang, sourceLang);

    // Format response
    const langInfo = sourceLang === 'auto' 
      ? `→ ${targetLang.toUpperCase()}`
      : `${sourceLang.toUpperCase()} → ${targetLang.toUpperCase()}`;

    return {
      text: `*Traducción* (${langInfo}):\n\n${translatedText}`
    };

  } catch (err) {
    console.error('Translate command error:', err);
    
    // Return user-friendly error message
    if (err.message.includes('Translation failed')) {
      return {
        text: 'No se pudo traducir el texto. Por favor intenta de nuevo más tarde.'
      };
    }

    return {
      text: 'Ha ocurrido un error al traducir el texto. Verifica el formato del comando.'
    };
  }
}

export { execute };
