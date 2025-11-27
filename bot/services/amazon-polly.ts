/**
 * Amazon Polly Text-to-Speech Service
 */

import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';

const REGION = 'us-east-1';

const voiceOptions = {
  Ricardo: 'standard',
  Conchita: 'standard',
  Lucia: 'neural',
  Enrique: 'standard',
  Sergio: 'neural',
  Mia: 'neural',
  Andres: 'neural',
  Lupe: 'neural',
  Penelope: 'neural',
  Miguel: 'standard',
};

/**
 * Creates Amazon Polly service
 * @param {Object} config - Configuration object
 * @returns {Object} Polly service
 */
function createAmazonPollyService(config) {
  // Config is not used for Polly, but keeping consistent API

  /**
   * Get a random voice ID
   * @returns {string} Random voice ID
   */
  function getRandomVoice() {
    const voices = Object.keys(voiceOptions);
    return voices[Math.floor(Math.random() * voices.length)];
  }

  /**
   * Check if a voice ID is valid
   * @param {string} voiceId - Voice ID to check
   * @returns {boolean} True if valid
   */
  function isValidVoice(voiceId) {
    return Object.prototype.hasOwnProperty.call(voiceOptions, voiceId);
  }

  /**
   * Synthesize speech from text
   * @param {string} text - Text to synthesize
   * @param {string} voiceId - Voice ID to use
   * @returns {Promise<Buffer>} Audio buffer
   */
  async function synthesizeSpeech(text, voiceId) {
    const client = new PollyClient({ region: REGION });

    const params = {
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: voiceId,
      Engine: voiceOptions[voiceId],
    };

    try {
      const command = new SynthesizeSpeechCommand(params);
      const data = await client.send(command);
      return data.AudioStream;
    } catch (err) {
      console.error('Failed to synthesize speech:', err);
      throw new Error('Failed to synthesize speech');
    }
  }

  return { getRandomVoice, isValidVoice, synthesizeSpeech };
}

export { createAmazonPollyService };

