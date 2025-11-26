const { robotEmoji } = require("../functions/globals");

async function sendMessage(client, message, text) {
  await client.sendMessage(message.from, `${robotEmoji} ${text}`);
}

module.exports = { sendMessage };
