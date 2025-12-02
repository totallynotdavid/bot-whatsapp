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

function getAdminIds(participants) {
  return participants
    .filter((p) => p.isAdmin)
    .map((p) => p.id._serialized);
}

async function getTargetUserIds(message) {
  if (message.mentionedIds.length > 0) {
    return message.mentionedIds;
  }

  if (message.hasQuotedMsg) {
    const quoted = await message.getQuotedMessage();
    return [quoted.author || quoted.from];
  }

  return [];
}

async function handlePromote(message) {
  const chat = await message.getChat();
  if (!chat.isGroup) return;

  if (!isBotAdmin(chat.participants)) {
    return message.reply('I need admin permissions to promote users.');
  }

  const targetIds = await getTargetUserIds(message);

  if (targetIds.length === 0) {
    return message.reply('Mention users or reply to a message to promote someone.');
  }

  const adminIds = getAdminIds(chat.participants);
  const toPromote = targetIds.filter((id) => !adminIds.includes(id));

  if (toPromote.length === 0) {
    return message.reply('All specified users are already admins.');
  }

  try {
    await chat.promoteParticipants(toPromote);
    await message.reply(`Promoted ${toPromote.length} user(s) to admin.`);
  } catch {
    await message.reply('Failed to promote users.');
  }
}

async function handleDemote(message) {
  const chat = await message.getChat();
  if (!chat.isGroup) return;

  if (!isBotAdmin(chat.participants)) {
    return message.reply('I need admin permissions to demote users.');
  }

  const targetIds = await getTargetUserIds(message);

  if (targetIds.length === 0) {
    return message.reply('Mention users or reply to a message to demote someone.');
  }

  const adminIds = getAdminIds(chat.participants);
  const toDemote = targetIds.filter((id) => adminIds.includes(id));

  if (toDemote.length === 0) {
    return message.reply('None of the specified users are admins.');
  }

  try {
    await chat.demoteParticipants(toDemote);
    await message.reply(`Demoted ${toDemote.length} user(s) from admin.`);
  } catch {
    await message.reply('Failed to demote users.');
  }
}

client.on('message_create', async (message) => {
  if (!message.fromMe) return;

  const command = message.body.trim();

  if (command.startsWith('!promote')) {
    await handlePromote(message);
  } else if (command.startsWith('!demote')) {
    await handleDemote(message);
  }
});

client.on('ready', () => {
  console.log('WhatsApp client is ready.');
});

client.initialize();
