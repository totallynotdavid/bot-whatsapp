// this command should only should only run groups,
// and only by paid tier users

const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
  authStrategy: new LocalAuth(),
});

// Tune these two values if needed
const MENTION_CHUNK_SIZE = 25;   // how many users per message
const MENTION_CHUNK_DELAY_MS = 2000; // pause between messages

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mention all group members in chunks so WhatsApp does not reject the message
async function mentionAllInChunks(message) {
  const chat = await message.getChat();
  if (!chat.isGroup) return;

  // Convert participants to Contact objects
  const contacts = await Promise.all(
    chat.participants.map((p) =>
      client.getContactById(p.id._serialized)
    )
  );

  // Send multiple messages, each mentioning a subset of users
  for (let i = 0; i < contacts.length; i += MENTION_CHUNK_SIZE) {
    const chunk = contacts.slice(i, i + MENTION_CHUNK_SIZE);
    const text = chunk.map((c) => `@${c.id.user}`).join(' ');

    await chat.sendMessage(text, { mentions: chunk });

    const hasMoreChunks = i + MENTION_CHUNK_SIZE < contacts.length;
    if (hasMoreChunks) {
      await sleep(MENTION_CHUNK_DELAY_MS);
    }
  }
}

// Simple command: send "!all" (from your own account) in a group
client.on('message_create', async (message) => {
  if (!message.fromMe) return;
  if (message.body.trim() !== '!all') return;

  await mentionAllInChunks(message);
});

client.on('ready', () => {
  console.log('WhatsApp client is ready.');
});

client.initialize();
