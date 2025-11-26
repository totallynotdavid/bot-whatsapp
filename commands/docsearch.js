const { searchFolderDatabase } = require(`../lib/api/gdrive`);

async function searchDocuments(stringifyMessage, message, query, robotEmoji) {
  if (stringifyMessage.length >= 2) {
    searchFolderDatabase(query)
      .then((results) => {
        if (results && results.length > 0) {
          let messageText = `${robotEmoji} Resultados:\n\n`;
          const limit = Math.min(5, results.length);
          for (let i = 0; i < limit; i++) {
            const file = results[i];
            messageText += `${i + 1}. ${file.name} (${file.webViewLink})\n`;
          }
          message.reply(messageText);
        } else {
          message.reply(`${robotEmoji} No se encontraron resultados.`);
        }
      })
      .catch((error) => {
        console.error(`Error searching folder cache:`, error);
      });
  } else {
    message.reply(`${robotEmoji} Ya, pero, ¿de qué quieres buscar?`);
  }
}

module.exports = {
  searchDocuments,
};
