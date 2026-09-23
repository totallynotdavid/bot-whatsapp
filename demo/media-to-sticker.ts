const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
  authStrategy: new LocalAuth(),
});

async function stickerToMedia(message) {
  const chat = await message.getChat();

  const quotedMsg = message._data.quotedMsg;

  if (!quotedMsg) {
    return message.reply('Reply to a sticker to convert it to media.');
  }

  if (quotedMsg.type !== 'sticker') {
    return message.reply('The quoted message must be a sticker.');
  }

  const quoted = await message.getQuotedMessage();
  const media = await quoted.downloadMedia();
  await chat.sendMessage(media);
}

client.on('message_create', async (message) => {
  if (!message.fromMe) return;
  if (message.body.trim() !== '!unsticker') return;
  await stickerToMedia(message);
});

client.on('ready', () => {
  console.log('WhatsApp client is ready.');
});

client.initialize();
