// This file is only available to give support to other commands
// These are not exposed on the bot
const fs = require(`fs`).promises;

function capitalizeText(s) {
  return s && s[0].toUpperCase() + s.slice(1);
}

function codeWrapper(message) {
  return `\`\`\`` + message + `\`\`\``;
}

function convertArrayToDict(commandArray) {
  return commandArray.reduce((dict, commandObj) => {
    dict[commandObj.command] = commandObj;
    return dict;
  }, {});
}

function commandGenerator(fixedDataCommandDict, stringifyMessage, prefix) {
  try {
    const command = stringifyMessage[1];
    const commandObj = fixedDataCommandDict[command];

    if (!commandObj) {
      return `Parece que ${codeWrapper(command)} no existe.`;
    }

    const { message, usage } = commandObj;

    if (usage) {
      let usageText;
      if (Array.isArray(usage)) {
        usageText = usage.map((item) => `${prefix}${item}`).join("\n");
      } else {
        usageText = `${prefix}${usage}`;
      }
      return `${message}.\n\n*Ejemplo de uso*:\n\n${codeWrapper(usageText)}`;
    }

    return message;
  } catch (err) {
    console.error(err);
    return `Ha ocurrido un error al generar la información del comando.`;
  }
}

function hasNonWhitespace(str) {
  return /[^ \t\n\r\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/.test(str);
}

function containsVisibleChars(str) {
  // Check if the string contains any alphanumeric or non-whitespace character
  return /[a-zA-Z0-9]/.test(str) && hasNonWhitespace(str);
}

// used to format numbers with spaces
function formatNumber(number) {
  const parts = [];
  let str = number.toString();
  while (str.length > 3) {
    parts.unshift(str.slice(-3));
    str = str.slice(0, -3);
  }
  if (str.length > 0) {
    parts.unshift(str);
  }
  return parts.join(` `);
}

function deleteFile(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(`Error deleting file: ${err}`);
    } else {
      console.log(`File ${filePath} deleted successfully`);
    }
  });
}

/**
 * Checks if a file is less than a specified size.
 * @param {string} filePath - Path to the file.
 * @param {number} maxSizeInMB - Maximum file size in MB.
 * @returns {Promise<boolean>} - Promise that resolves to true if file is within size limit.
 */
async function isFileSizeWithinLimit(filePath, maxSizeInMB) {
  try {
    const stats = await fs.stat(filePath);
    const fileSizeInBytes = stats.size;
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return fileSizeInBytes <= maxSizeInBytes;
  } catch (error) {
    console.error(`Error checking file size:`, error);
    throw error;
  }
}

module.exports = {
  capitalizeText,
  commandGenerator,
  convertArrayToDict,
  codeWrapper,
  containsVisibleChars,
  formatNumber,
  deleteFile,
  isFileSizeWithinLimit,
};
