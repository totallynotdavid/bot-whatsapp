// only for paid users

const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
  authStrategy: new LocalAuth(),
});

function getBotId() {
  return `${client.info.wid.user}@c.us`;
}

function isBotAdmin(participants) {
  const botId = getBotId();
  return participants.some((p) => p.id._serialized === botId && p.isAdmin);
}

async function banUsers(chat, userIds) {
  const botId = getBotId();
  const safeToBan = userIds.filter((id) => !id.startsWith(botId.split('@')[0]));

  let banned = 0;
  let failed = 0;

  for (const userId of safeToBan) {
    try {
      await chat.removeParticipants([userId]);
      banned++;
    } catch {
      failed++;
    }
  }

  return { banned, failed };
}

async function handleBanCommand(message) {
  const chat = await message.getChat();
  if (!chat.isGroup) return;

  if (!isBotAdmin(chat.participants)) {
    return message.reply("I need admin permissions to ban users.");
  }

  let userIdsToBan = [];

  if (message.mentionedIds.length > 0) {
    userIdsToBan = message.mentionedIds;
  } else if (message.hasQuotedMsg) {
    const quoted = await message.getQuotedMessage();
    userIdsToBan = [quoted.author || quoted.from];
  }

  if (userIdsToBan.length === 0) {
    return message.reply("Mention users or reply to a message to ban someone.");
  }

  const { banned, failed } = await banUsers(chat, userIdsToBan);

  if (banned > 0) await message.reply("Banned ${banned} user(s).");
  if (failed > 0) await message.reply("Failed to ban ${failed} user(s).");
}

client.on('message_create', async (message) => {
  if (!message.fromMe) return;
  if (!message.body.trim().startsWith('!ban')) return;
  await handleBanCommand(message);
});

client.on('ready', () => {
  console.log('WhatsApp client is ready.');
});

client.initialize();
