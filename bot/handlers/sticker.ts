/**
 * Sticker Command Handler
 * 
 * Converts images and videos to WhatsApp stickers.
 * Supports quoted messages, attached media, and URLs.
 */

import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;

// Maximum file size in bytes (16MB for WhatsApp limit)
const MAX_FILE_SIZE = 16 * 1024 * 1024;

// Cleanup delay in milliseconds (30 seconds)
const CLEANUP_DELAY = 30 * 1000;

/**
 * Checks if media size is within limits before downloading
 * @param {string} url - Media URL
 * @returns {Promise<{ok: boolean, size?: number, error?: string}>}
 */
async function checkMediaSize(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    
    if (!response.ok) {
      return { ok: false, error: 'Unable to access media URL' };
    }
    
    const contentLength = response.headers.get('content-length');
    
    if (!contentLength) {
      // If no content-length header, we can't check size
      return { ok: true };
    }
    
    const size = parseInt(contentLength, 10);
    
    if (size > MAX_FILE_SIZE) {
      return { 
        ok: false, 
        size,
        error: `File size (${(size / 1024 / 1024).toFixed(2)}MB) exceeds limit (${MAX_FILE_SIZE / 1024 / 1024}MB)` 
      };
    }
    
    return { ok: true, size };
  } catch (error) {
    console.error('Error checking media size:', error);
    return { ok: false, error: 'Failed to check media size' };
  }
}

/**
 * Schedules cleanup of temporary files
 * @param {Array<string>} filePaths - Paths to clean up
 */
function scheduleCleanup(filePaths) {
  setTimeout(() => {
    // Cleanup logic would go here
    // For now, just log (actual cleanup depends on whatsapp-web.js internals)
    console.log(`Scheduled cleanup for ${filePaths.length} files`);
  }, CLEANUP_DELAY);
}

/**
 * Converts media to sticker
 * @param {Object} message - WhatsApp message object
 * @param {Object} media - MessageMedia object
 * @param {string} senderName - Name of sender
 * @returns {Promise<void>}
 */
async function convertToSticker(message, media, senderName) {
  try {
    // Sanitize sender name
    let authorName = senderName.trim();
    if (!authorName || authorName.length < 2) {
      authorName = 'Usuario';
    }
    
    // Send as sticker
    await message.reply(media, message.from, {
      sendMediaAsSticker: true,
      stickerName: authorName,
      stickerAuthor: 'Bot',
    });
    
    // Schedule cleanup
    scheduleCleanup([media.filename || 'temp']);
    
    return { success: true };
  } catch (error) {
    console.error('Error converting to sticker:', error);
    throw error;
  }
}

/**
 * Handles sticker conversion from URL
 * @param {Object} ctx - Command context
 * @param {string} url - Media URL
 * @returns {Promise<Object>} Result object
 */
async function handleUrlSticker(ctx, url) {
  const { parsed } = ctx;
  
  // Check size before downloading
  const sizeCheck = await checkMediaSize(url);
  
  if (!sizeCheck.ok) {
    return {
      text: `🤖 ${sizeCheck.error || 'No se puede procesar esta URL'}`,
    };
  }
  
  try {
    // Download media
    const media = await MessageMedia.fromUrl(url);
    
    // Convert to sticker
    await convertToSticker(
      ctx.message,
      media,
      parsed.sender.name
    );
    
    return {
      text: '🤖 ¡Sticker en camino!',
    };
  } catch (error) {
    console.error('Error processing URL sticker:', error);
    return {
      text: '🤖 Hubo un error al procesar esta URL.',
    };
  }
}

/**
 * Handles sticker conversion from quoted message
 * @param {Object} ctx - Command context
 * @returns {Promise<Object>} Result object
 */
async function handleQuotedSticker(ctx) {
  const { message, parsed } = ctx;
  
  try {
    const quotedMsg = await message.getQuotedMessage();
    
    if (!quotedMsg) {
      return {
        text: '🤖 Por favor, responde a un mensaje con imagen o video.',
      };
    }
    
    // If quoted message is a sticker, convert back to image
    if (quotedMsg.type === 'sticker') {
      const media = await quotedMsg.downloadMedia();
      await message.reply(media, message.from, {
        sendMediaAsSticker: false,
        caption: `🤖 Solicitado por ${parsed.sender.name}`,
      });
      
      scheduleCleanup([media.filename || 'temp']);
      
      return { text: null }; // Already sent
    }
    
    // Check if quoted message has media
    if (!quotedMsg.hasMedia) {
      return {
        text: '🤖 Este mensaje no contiene ninguna imagen o video.',
      };
    }
    
    // Download and convert
    const media = await quotedMsg.downloadMedia();
    
    await convertToSticker(
      message,
      media,
      parsed.sender.name
    );
    
    return {
      text: '🤖 ¡Sticker en camino!',
    };
  } catch (error) {
    console.error('Error processing quoted sticker:', error);
    return {
      text: '🤖 Hubo un error al procesar este mensaje.',
    };
  }
}

/**
 * Handles sticker conversion from attached media
 * @param {Object} ctx - Command context
 * @returns {Promise<Object>} Result object
 */
async function handleAttachedSticker(ctx) {
  const { message, parsed } = ctx;
  
  try {
    if (!message.hasMedia) {
      return {
        text: '🤖 Por favor, adjunta una imagen o video.',
      };
    }
    
    // Download media
    const media = await message.downloadMedia();
    
    await convertToSticker(
      message,
      media,
      parsed.sender.name
    );
    
    return {
      text: '🤖 ¡Sticker en camino!',
    };
  } catch (error) {
    console.error('Error processing attached sticker:', error);
    return {
      text: '🤖 Hubo un error al convertir esta imagen en sticker.',
    };
  }
}

/**
 * Execute sticker command
 * 
 * @param {Object} ctx - Command context
 * @param {Object} ctx.parsed - Parsed command information
 * @param {string[]} ctx.parsed.args - Command arguments
 * @param {Object} ctx.parsed.sender - Sender information
 * @param {Object} ctx.message - WhatsApp message object
 * @returns {Promise<{text?: string}>} Result object
 */
async function execute(ctx) {
  try {
    const { parsed, message } = ctx;
    const { args } = parsed;
    
    // Case 1: URL provided
    if (args.length > 0) {
      const url = args[0];
      
      // Basic URL validation
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return {
          text: '🤖 Por favor, proporciona una URL válida.',
        };
      }
      
      return await handleUrlSticker(ctx, url);
    }
    
    // Case 2: Quoted message
    if (message.hasQuotedMsg) {
      return await handleQuotedSticker(ctx);
    }
    
    // Case 3: Attached media
    if (message.hasMedia) {
      return await handleAttachedSticker(ctx);
    }
    
    // No media provided
    return {
      text: '🤖 Por favor, adjunta una imagen, responde a un mensaje con media, o proporciona una URL.',
    };
  } catch (error) {
    console.error('Sticker command error:', error);
    return {
      text: '🤖 Hubo un error al procesar el comando de sticker.',
    };
  }
}

export { 
  execute,
  checkMediaSize,
  scheduleCleanup,
  MAX_FILE_SIZE,
  CLEANUP_DELAY,
};


