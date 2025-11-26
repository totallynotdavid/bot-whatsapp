const {
  commandGenerator,
  convertArrayToDict,
  codeWrapper,
} = require("./utilities");

const helpListCommands = require("../data/helpListCommands.json");
const helpListCommandsDict = convertArrayToDict(helpListCommands);

const helpAdminListCommands = require("../data/helpAdminListCommands.json");
const helpAdminListCommandsDict = convertArrayToDict(helpAdminListCommands);

// User commands

function getHelpMessage(prefix, stringifyMessage, helpCommand) {
  try {
    switch (stringifyMessage.length) {
      case 1:
        return sendHelpList(prefix, helpCommand);
      case 2:
        return commandGenerator(helpListCommandsDict, stringifyMessage, prefix);
      default:
        return `Este comando no es válido. Usa ${prefix}${helpCommand} para ver los comandos disponibles.`;
    }
  } catch (err) {
    console.error(err);
    return `Ha ocurrido un error al procesar el comando de ayuda.`;
  }
}

function sendHelpList(prefix, helpCommand) {
  try {
    const commands = helpListCommands.map(
      (command) => `${prefix}${command.command}`
    );
    return `Aquí tienes la lista de comandos disponibles:\n\n${codeWrapper(
      commands.join("\n")
    )}\n\nSi necesitas más información sobre un comando en particular, escribe: ${codeWrapper(
      `${prefix}${helpCommand} <comando>`
    )} (sin los símbolos <>).`;
  } catch (err) {
    console.error(err);
    return `Ha ocurrido un error al generar la lista de comandos.`;
  }
}

// Admin commands

function getAdminHelpMessage(prefix, stringifyMessage, helpCommand) {
  try {
    switch (stringifyMessage.length) {
      case 1:
        return sendAdminHelpList(prefix, helpCommand);
      case 2:
        return commandGenerator(
          helpAdminListCommandsDict,
          stringifyMessage,
          prefix
        );
      default:
        return `Este comando no es válido. Usa ${prefix}${helpCommand} para ver los comandos disponibles.`;
    }
  } catch (err) {
    console.error(err);
    return `Ha ocurrido un error al procesar el comando de ayuda de administración.`;
  }
}

function sendAdminHelpList(prefix, helpCommand) {
  try {
    const commands = helpAdminListCommands.map(
      (command) => `${prefix}${command.command}`
    );
    return `Aquí tienes la lista de comandos de administración disponibles:\n\n${codeWrapper(
      commands.join("\n")
    )}\n\nSi necesitas más información sobre un comando en particular, escribe: ${codeWrapper(
      `${prefix}${helpCommand} <comando>`
    )} (sin los símbolos <>).`;
  } catch (err) {
    console.error(err);
    return `Ha ocurrido un error al generar la lista de comandos de administración.`;
  }
}

module.exports = {
  getHelpMessage,
  getAdminHelpMessage,
};
