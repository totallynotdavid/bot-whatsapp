/**
 * Response sender module
 * Handles sending responses and errors to WhatsApp chats
 */

/**
 * Send a successful response to a WhatsApp chat
 * 
 * @param {Object} msg - Original WhatsApp message object
 * @param {Object} result - Result object from command handler
 * @param {string} [result.text] - Text message to send
 * @param {Object} [result.media] - Media object to send
 * @param {string} result.media.path - Path to media file
 * @param {string} result.media.type - Media type ('image', 'audio', 'video')
 * @param {string} [result.media.caption] - Optional caption for media
 * @returns {Promise<void>}
 */
async function sendResponse(msg, result) {
  // Validate inputs
  if (!msg || !msg.reply) {
    throw new Error('Invalid message object');
  }

  if (!result) {
    throw new Error('Invalid result object');
  }

  try {
    // Handle media response
    if (result.media) {
      const { path, type, caption } = result.media;

      if (!path) {
        throw new Error('Media path is required');
      }

      // Import MessageMedia dynamically
      const { MessageMedia } = await import('whatsapp-web.js');
      const media = MessageMedia.fromFilePath(path);

      // Prepare options based on media type
      const options = {};
      
      if (type === 'audio') {
        options.sendAudioAsVoice = true;
      }
      
      if (caption) {
        options.caption = caption;
      }

      // Send media
      await msg.reply(media, msg.from, options);

      return;
    }

    // Handle text response
    if (result.text) {
      await msg.reply(result.text);
      return;
    }

    // If neither text nor media, send default message
    await msg.reply('Command completed successfully');
  } catch (err) {
    console.error('Error sending response:', {
      error: err.message,
      stack: err.stack,
      chat: msg.from,
    });
    throw err;
  }
}

/**
 * Send an error message to a WhatsApp chat
 * 
 * @param {Object} msg - Original WhatsApp message object
 * @param {string} error - Error message to send
 * @returns {Promise<void>}
 */
async function sendError(msg, error) {
  // Validate inputs
  if (!msg || !msg.reply) {
    throw new Error('Invalid message object');
  }

  // Ensure error message is not empty
  const errorMessage = error && typeof error === 'string' && error.trim().length > 0
    ? error.trim()
    : 'An error occurred. Please try again later.';

  try {
    // Send user-friendly error message
    await msg.reply(`❌ ${errorMessage}`);
  } catch (err) {
    console.error('Error sending error message:', {
      error: err.message,
      stack: err.stack,
      chat: msg.from,
      originalError: error,
    });
    throw err;
  }
}

export { sendResponse, sendError };
