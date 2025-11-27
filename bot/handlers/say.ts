/**
 * Say Command Handler (Text-to-Speech)
 */

import { writeFile, unlink } from 'fs/promises';
import { createAmazonPollyService } from '../services/amazon-polly.ts';

/**
 * Cleanup timeout in milliseconds (30 seconds)
 */
const CLEANUP_TIMEOUT = 30000;

/**
 * Execute say command
 *
 * @param {Object} ctx - Command context
 * @param {Object} ctx.parsed - Parsed command information
 * @param {string[]} ctx.parsed.args - Command arguments
 * @param {Object} ctx.client - WhatsApp client
 * @param {Object} ctx.config - Configuration
 * @returns {Promise<{text?: string, media?: Object}>} Command result
 */
async function execute(ctx) {
  try {
    const { parsed, client, config } = ctx;
    const { args } = parsed;

    let text = '';
    const polly = createAmazonPollyService(config);
    let voiceId = polly.getRandomVoice();

    if (args.length === 0) {
      if (parsed.message.hasQuotedMsg) {
        text = parsed.message.quotedMsg.body;
      } else {
        return { text: 'Proporciona texto o responde a un mensaje.' };
      }
    } else {
      if (args[0].startsWith('-')) {
        const possibleVoiceId = args[0].slice(1);
        if (polly.isValidVoice(possibleVoiceId)) {
          voiceId = possibleVoiceId;
          text = args.slice(1).join(' ');
        } else {
          text = args.slice(1).join(' ');
        }
      } else {
        text = args.join(' ');
      }
    }

    if (text.length > 1000) {
      return { text: 'Texto demasiado largo. Límite: 1000 caracteres.' };
    }

    const audioBuffer = await polly.synthesizeSpeech(text, voiceId);

    // Save to temp file
    const tempPath = `temp_audio_${Date.now()}.mp3`;
    await writeFile(tempPath, audioBuffer);

    // Schedule cleanup
    setTimeout(async () => {
      try {
        await unlink(tempPath);
      } catch (error) {
        console.error('Error cleaning up audio file:', error);
      }
    }, CLEANUP_TIMEOUT);

    return {
      media: {
        path: tempPath,
        type: 'audio',
        caption: `Voz utilizada: ${voiceId}`,
      },
    };
  } catch (err) {
    console.error('Say command error:', err);
    return {
      text: 'Error al procesar la solicitud. Inténtalo de nuevo ahora o más tarde.',
    };
  }
}

export { execute };

