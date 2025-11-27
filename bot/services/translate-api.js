/**
 * Translation API Service
 * 
 * Provides translation functionality using Google Translate API.
 * Handles language detection and translation with proper error handling.
 */

import { translate } from '@vitalets/google-translate-api';

/**
 * Translate text from one language to another
 * 
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code (e.g., 'es', 'en')
 * @param {string} sourceLang - Source language code (default: 'auto' for auto-detection)
 * @returns {Promise<string>} Translated text
 * @throws {Error} If translation fails
 */
async function translateText(text, targetLang, sourceLang = 'auto') {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text to translate cannot be empty');
  }

  if (!targetLang || typeof targetLang !== 'string') {
    throw new Error('Target language must be specified');
  }

  try {
    const result = await translate(text.trim(), {
      from: sourceLang,
      to: targetLang,
    });

    return result.text;
  } catch (error) {
    console.error('Translation API error:', {
      text: text.substring(0, 50),
      targetLang,
      sourceLang,
      error: error.message,
    });
    throw new Error('Translation failed. Please try again later.');
  }
}

/**
 * Parse language codes from command arguments
 * Supports formats:
 * - "text" -> auto to default (es)
 * - "en text" -> auto to en
 * - "es en text" -> es to en
 * 
 * @param {string[]} args - Command arguments
 * @param {string} defaultTargetLang - Default target language (default: 'es')
 * @returns {{sourceLang: string, targetLang: string, text: string}}
 */
function parseTranslationArgs(args, defaultTargetLang = 'es') {
  const langPattern = /^[a-z]{2}$/i;
  
  if (args.length === 0) {
    return null;
  }

  // Check if first arg is a language code
  const firstIsLang = langPattern.test(args[0]);
  const secondIsLang = args.length > 1 && langPattern.test(args[1]);

  // Format: "es en text to translate"
  if (firstIsLang && secondIsLang) {
    return {
      sourceLang: args[0].toLowerCase(),
      targetLang: args[1].toLowerCase(),
      text: args.slice(2).join(' '),
    };
  }

  // Format: "en text to translate"
  if (firstIsLang) {
    return {
      sourceLang: 'auto',
      targetLang: args[0].toLowerCase(),
      text: args.slice(1).join(' '),
    };
  }

  // Format: "text to translate" (use default target)
  return {
    sourceLang: 'auto',
    targetLang: defaultTargetLang,
    text: args.join(' '),
  };
}

export {
  translateText,
  parseTranslationArgs,
};
