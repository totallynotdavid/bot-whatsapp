// only for paid users

const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
  authStrategy: new LocalAuth(),
});

const MAX_CONTACTS_PER_REQUEST = 3;

function getBotId() {
  return `${client.info.wid.user}@c.us`;
}

function isBotAdmin(participants) {
  const botId = getBotId();
  return participants.some((p) => p.id._serialized === botId && p.isAdmin);
}

function extractContactIdsFromVCards(vCards) {
  return vCards.map((vCard) => {
    const match = vCard.match(/waid=(\d+)/);
    return match ? `${match[1]}@c.us` : null;
  }).filter(Boolean);
}

async function addUsersToGroup(message) {
  const chat = await message.getChat();
  if (!chat.isGroup) return;

  if (!message.hasQuotedMsg) {
    return message.reply('Reply to a message containing contacts to add them.');
  }

  const quoted = await message.getQuotedMessage();

  if (!quoted.vCards || quoted.vCards.length === 0) {
    return message.reply('The quoted message does not contain any contacts.');
  }

  if (quoted.vCards.length > MAX_CONTACTS_PER_REQUEST) {
    return message.reply(`Cannot add more than ${MAX_CONTACTS_PER_REQUEST} contacts at once.`);
  }

  if (!isBotAdmin(chat.participants)) {
    return message.reply('I need admin permissions to add users.');
  }

  const contactIds = extractContactIdsFromVCards(quoted.vCards);

  if (contactIds.length === 0) {
    return message.reply('Could not extract contact IDs from the shared contacts.');
  }

  try {
    await chat.addParticipants(contactIds);
    await message.reply(`Added ${contactIds.length} user(s) to the group.`);
  } catch {
    await message.reply('Failed to add users. They might already be in the group or have privacy settings enabled.');
  }
}

client.on('message_create', async (message) => {
  if (!message.fromMe) return;
  if (message.body.trim() !== '!add') return;
  await addUsersToGroup(message);
});

client.on('ready', () => {
  console.log('WhatsApp client is ready.');
});

client.initialize();
