// only for paid users

const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
  authStrategy: new LocalAuth(),
});

const INVITE_LINK_PREFIX = 'https://chat.whatsapp.com/';

function extractInviteCode(link) {
  if (!link.startsWith(INVITE_LINK_PREFIX)) return null;
  return link.replace(INVITE_LINK_PREFIX, '');
}

async function joinGroup(message) {
  const args = message.body.trim().split(/\s+/);

  if (args.length !== 2) {
    return message.reply('Usage: !join https://chat.whatsapp.com/INVITE_CODE');
  }

  const inviteCode = extractInviteCode(args[1]);

  if (!inviteCode) {
    return message.reply('Invalid invite link. Must start with https://chat.whatsapp.com/');
  }

  try {
    const groupId = await client.acceptInvite(inviteCode);

    // TODO: Add groupId to the list of managed groups if needed

    const group = await client.getChatById(groupId);
    await group.sendMessage('Hello! I just joined this group.');
    await message.reply('Successfully joined the group.');
  } catch {
    await message.reply('Failed to join. Check if the invite link is valid and active.');
  }
}

client.on('message_create', async (message) => {
  if (!message.fromMe) return;
  if (!message.body.trim().startsWith('!join')) return;
  await joinGroup(message);
});

client.on('ready', () => {
  console.log('WhatsApp client is ready.');
});

client.initialize();
