/**
 * Command Executor
 * 
 * Routes commands to their handlers and executes them with proper error containment.
 * Follows fail-fast principles with explicit error handling.
 */

// Explicit handler map (no auto-discovery)
// Handlers will be added as they are migrated
import * as helpHandler from '../handlers/help.ts';
import * as stickerHandler from '../handlers/sticker.ts';
import * as chatHandler from '../handlers/chat.ts';
import * as spotifyHandler from '../handlers/spotify.ts';
import * as translateHandler from '../handlers/translate.ts';
import * as wikipediaHandler from '../handlers/wikipedia.ts';
import * as youtubeHandler from '../handlers/youtube.ts';
import * as redditHandler from '../handlers/reddit.ts';
import * as doiHandler from '../handlers/doi.ts';
import * as texHandler from '../handlers/tex.ts';
import * as sayHandler from '../handlers/say.ts';
import * as editImageHandler from '../handlers/editImage.ts';
import * as paperHandler from '../handlers/paper.ts';
import * as authorHandler from '../handlers/author.ts';
import * as docsearchHandler from '../handlers/docsearch.ts';
import * as docdownHandler from '../handlers/docdown.ts';

// Admin handlers
import * as mentionsHandler from '../handlers/admin/mentions.ts';
import * as subscriptionHandler from '../handlers/admin/subscription.ts';
import * as refreshHandler from '../handlers/admin/refresh.ts';
import * as addgroupHandler from '../handlers/admin/addgroup.ts';
import * as addpremiumHandler from '../handlers/admin/addpremium.ts';
import * as banHandler from '../handlers/admin/ban.ts';
import * as botHandler from '../handlers/admin/bot.ts';
import * as delHandler from '../handlers/admin/del.ts';
import * as joinHandler from '../handlers/admin/join.ts';
import * as addHandler from '../handlers/admin/add.ts';
import * as promoteHandler from '../handlers/admin/promote.ts';
import * as demoteHandler from '../handlers/admin/demote.ts';
import * as resumenHandler from '../handlers/admin/resumen.ts';
import * as imagineHandler from '../handlers/admin/imagine.ts';
import * as globalHandler from '../handlers/admin/global.ts';

import logger from '../utils/logger.ts';

const handlers = {
  // Commands will be registered here as they are implemented
  help: helpHandler,
  sticker: stickerHandler,
  chat: chatHandler,
  spotify: spotifyHandler,
  translate: translateHandler,
  w: wikipediaHandler,
  yt: youtubeHandler,
  reddit: redditHandler,
  doi: doiHandler,
  tex: texHandler,
  say: sayHandler,
  editimage: editImageHandler,
  paper: paperHandler,
  author: authorHandler,
  docsearch: docsearchHandler,
  docdown: docdownHandler,
};

const adminHandlers = {
  // Admin commands
  todos: mentionsHandler,
  subscription: subscriptionHandler,
  refresh: refreshHandler,
  addgroup: addgroupHandler,
  addpremium: addpremiumHandler,
  ban: banHandler,
  bot: botHandler,
  del: delHandler,
  join: joinHandler,
  add: addHandler,
  promote: promoteHandler,
  demote: demoteHandler,
  resumen: resumenHandler,
  imagine: imagineHandler,
  global: globalHandler,
};

/**
 * Execute a command by routing it to the appropriate handler
 * 
 * @param {Object} ctx - Command context
 * @param {Object} ctx.parsed - Parsed command information
 * @param {Object} ctx.db - Database instance
 * @param {Object} ctx.client - WhatsApp client
 * @param {Object} ctx.config - Configuration
 * @param {Object} ctx.cache - Premium cache
 * @returns {Promise<{data?: any, error?: string}>} Result object with either data or error
 */
async function executeCommand(ctx) {
  // Validate context
  if (!ctx || !ctx.parsed || !ctx.parsed.command) {
    return { error: 'Invalid command context' };
  }

  const commandName = ctx.parsed.command.toLowerCase();
  const handlerMap = ctx.parsed.isAdmin ? adminHandlers : handlers;
  const handler = handlerMap[commandName];

  // Check if handler exists
  if (!handler) {
    return { error: `Unknown command: ${commandName}` };
  }

  // Validate handler has execute function
  if (typeof handler.execute !== 'function') {
    logger.error(`Handler for ${commandName} is missing execute function`, new Error('Invalid handler'), { command: commandName });
    return { error: 'Command handler is invalid' };
  }

  // Execute with error containment
  try {
    const result = await handler.execute(ctx);
    
    // Ensure result is in correct format
    if (!result) {
      return { data: { text: 'Command completed' } };
    }

    return { data: result };
  } catch (err) {
    // Log error with context for debugging
    logger.error('Command execution error', err, {
      command: commandName,
      sender: ctx.parsed.sender?.phone,
      chat: ctx.parsed.chat?.id,
    });

    // Return user-friendly error
    return { error: 'Command failed. Please try again later.' };
  }
}

/**
 * Register a command handler
 * 
 * @param {string} commandName - Name of the command
 * @param {Object} handler - Handler object with execute function
 */
function registerHandler(commandName, handler) {
  if (!commandName || typeof commandName !== 'string') {
    throw new Error('Command name must be a non-empty string');
  }

  if (!handler || typeof handler.execute !== 'function') {
    throw new Error('Handler must have an execute function');
  }

  handlers[commandName.toLowerCase()] = handler;
}

/**
 * Get list of registered commands
 * 
 * @returns {string[]} Array of registered command names
 */
function getRegisteredCommands() {
  return Object.keys(handlers);
}

/**
 * Clear all registered handlers (for testing purposes)
 */
function clearHandlers() {
  Object.keys(handlers).forEach(key => delete handlers[key]);
}

export {
  executeCommand,
  registerHandler,
  getRegisteredCommands,
  clearHandlers,
};


