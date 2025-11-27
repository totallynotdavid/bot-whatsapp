/**
 * Help Command Handler
 * 
 * Provides help information about available commands.
 * Supports both regular and admin command help.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load command data
const helpListCommands = JSON.parse(
  readFileSync(join(__dirname, '../../data/helpListCommands.tson'), 'utf-8')
);

const helpAdminListCommands = JSON.parse(
  readFileSync(join(__dirname, '../../data/helpAdminListCommands.tson'), 'utf-8')
);

/**
 * Wraps text in code formatting
 * @param {string} text - Text to wrap
 * @returns {string} Formatted text
 */
function codeWrapper(text) {
  return `\`\`\`${text}\`\`\``;
}

/**
 * Converts command array to dictionary for O(1) lookup
 * @param {Array} commandArray - Array of command objects
 * @returns {Object} Dictionary with command names as keys
 */
function convertArrayToDict(commandArray) {
  return commandArray.reduce((dict, commandObj) => {
    dict[commandObj.command] = commandObj;
    return dict;
  }, {});
}

const helpListCommandsDict = convertArrayToDict(helpListCommands);
const helpAdminListCommandsDict = convertArrayToDict(helpAdminListCommands);

/**
 * Generates help message for a specific command
 * @param {Object} commandDict - Dictionary of commands
 * @param {string} commandName - Name of the command
 * @param {string} prefix - Command prefix
 * @returns {string} Help message
 */
function generateCommandHelp(commandDict, commandName, prefix) {
  const commandObj = commandDict[commandName];

  if (!commandObj) {
    return `Parece que ${codeWrapper(commandName)} no existe.`;
  }

  const { message, usage } = commandObj;

  if (usage) {
    let usageText;
    if (Array.isArray(usage)) {
      usageText = usage.map((item) => `${prefix}${item}`).join('\n');
    } else {
      usageText = `${prefix}${usage}`;
    }
    return `${message}.\n\n*Ejemplo de uso*:\n\n${codeWrapper(usageText)}`;
  }

  return message;
}

/**
 * Generates list of all available commands
 * @param {Array} commandList - List of command objects
 * @param {string} prefix - Command prefix
 * @param {string} helpCommand - Name of help command
 * @param {boolean} isAdmin - Whether this is for admin commands
 * @returns {string} Help list message
 */
function generateCommandList(commandList, prefix, helpCommand, isAdmin = false) {
  const commands = commandList.map((command) => `${prefix}${command.command}`);
  const commandType = isAdmin ? 'de administración ' : '';
  
  return `Aquí tienes la lista de comandos ${commandType}disponibles:\n\n${codeWrapper(
    commands.join('\n')
  )}\n\nSi necesitas más información sobre un comando en particular, escribe: ${codeWrapper(
    `${prefix}${helpCommand} <comando>`
  )} (sin los símbolos <>).`;
}

/**
 * Execute help command
 * 
 * @param {Object} ctx - Command context
 * @param {Object} ctx.parsed - Parsed command information
 * @param {string[]} ctx.parsed.args - Command arguments
 * @param {boolean} ctx.parsed.isAdmin - Whether this is an admin command
 * @param {Object} ctx.config - Configuration
 * @param {string} ctx.config.prefix - Regular command prefix
 * @param {string} ctx.config.adminPrefix - Admin command prefix
 * @returns {Promise<{text: string}>} Help message
 */
async function execute(ctx) {
  try {
    const { parsed, config } = ctx;
    const { args, isAdmin } = parsed;
    const prefix = isAdmin ? config.adminPrefix : config.prefix;
    const helpCommand = isAdmin ? 'help' : 'help';

    // No arguments - show command list
    if (args.length === 0) {
      const commandList = isAdmin ? helpAdminListCommands : helpListCommands;
      const text = generateCommandList(commandList, prefix, helpCommand, isAdmin);
      return { text };
    }

    // One argument - show specific command help
    if (args.length === 1) {
      const commandName = args[0];
      const commandDict = isAdmin ? helpAdminListCommandsDict : helpListCommandsDict;
      const text = generateCommandHelp(commandDict, commandName, prefix);
      return { text };
    }

    // Too many arguments
    return {
      text: `Este comando no es válido. Usa ${prefix}${helpCommand} para ver los comandos disponibles.`
    };
  } catch (err) {
    console.error('Help command error:', err);
    return {
      text: 'Ha ocurrido un error al procesar el comando de ayuda.'
    };
  }
}

export { execute };


