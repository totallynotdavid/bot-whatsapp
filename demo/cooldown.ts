// only for paid users

const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
  authStrategy: new LocalAuth(),
});

const DEFAULT_COOLDOWN_MINUTES = 5;

function getBotId() {
  return `${client.info.wid.user}@c.us`;
}

function isBotAdmin(participants) {
  const botId = getBotId();
  return participants.some((p) => p.id._serialized === botId && p.isAdmin);
}

function parseMinutes(args) {
  const minutes = parseInt(args[1], 10);
  return isNaN(minutes) || minutes < 1 ? DEFAULT_COOLDOWN_MINUTES : minutes;
}

async function cooldownGroup(message) {
  const chat = await message.getChat();
  if (!chat.isGroup) return;

  if (!isBotAdmin(chat.participants)) {
    return message.reply('I need admin permissions to manage group settings.');
  }

  const args = message.body.trim().split(/\s+/);
  const minutes = parseMinutes(args);

  try {
    await chat.setMessagesAdminsOnly(true);
    await message.reply(`Group restricted to admins only for ${minutes} minute(s).`);

    setTimeout(async () => {
      try {
        await chat.setMessagesAdminsOnly(false);
        await chat.sendMessage('Cooldown ended. Everyone can send messages again.');
      } catch {
        // Group might have been deleted or bot removed
      }
    }, minutes * 60 * 1000);
  } catch {
    await message.reply('Failed to restrict the group. Check bot permissions.');
  }
}

client.on('message_create', async (message) => {
  if (!message.fromMe) return;
  if (!message.body.trim().startsWith('!cooldown')) return;
  await cooldownGroup(message);
});

client.on('ready', () => {
  console.log('WhatsApp client is ready.');
});

client.initialize();
