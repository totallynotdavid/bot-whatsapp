// only for paid users

const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
  authStrategy: new LocalAuth(),
});

const MAX_MESSAGES_TO_DELETE = 10;

function getBotId() {
  return `${client.info.wid.user}@c.us`;
}

function isBotAdmin(participants) {
  const botId = getBotId();
  return participants.some((p) => p.id._serialized === botId && p.isAdmin);
}

async function deleteLastMessages(message) {
  const chat = await message.getChat();
  if (!chat.isGroup) return;

  if (!isBotAdmin(chat.participants)) {
    return message.reply('I need admin permissions to delete messages.');
  }

  const messages = await chat.fetchMessages({ limit: MAX_MESSAGES_TO_DELETE + 1 });

  const toDelete = messages
    .filter((msg) => msg.id._serialized !== message.id._serialized)
    .slice(-MAX_MESSAGES_TO_DELETE);

  let deleted = 0;

  for (const msg of toDelete) {
    try {
      await msg.delete(true);
      deleted++;
    } catch {
      // Message might be too old or not deletable
    }
  }

  await message.reply(`Deleted ${deleted} message(s).`);
}

client.on('message_create', async (message) => {
  if (!message.fromMe) return;
  if (message.body.trim() !== '!purge') return;
  await deleteLastMessages(message);
});

client.on('ready', () => {
  console.log('WhatsApp client is ready.');
});

client.initialize();
