// only for paid users

const { Client, LocalAuth } = require('whatsapp-web.js');
const OpenAI = require('openai');

const client = new Client({
  authStrategy: new LocalAuth(),
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_MESSAGE_COUNT = 50;
const MAX_MESSAGE_COUNT = 100;

function parseMessageCount(args) {
  const count = parseInt(args[1], 10);
  if (isNaN(count) || count < 1) return DEFAULT_MESSAGE_COUNT;
  return Math.min(count, MAX_MESSAGE_COUNT);
}

function buildAuthorMap(messages) {
  const authors = [...new Set(
    messages
      .map((msg) => msg.author || msg.from)
      .filter(Boolean)
  )];

  const placeholderToId = {};
  const idToPlaceholder = {};

  authors.forEach((authorId, index) => {
    const placeholder = `<<U${index + 1}>>`;
    placeholderToId[placeholder] = authorId;
    idToPlaceholder[authorId] = placeholder;
  });

  return { placeholderToId, idToPlaceholder };
}

function formatMessagesForSummary(messages, idToPlaceholder) {
  return messages
    .filter((msg) => msg.body?.trim())
    .map((msg) => {
      const authorId = msg.author || msg.from;
      const placeholder = idToPlaceholder[authorId] || 'Unknown';
      return `${placeholder}: ${msg.body.trim()}`;
    })
    .join('\n');
}

function replacePlaceholdersWithMentions(text, placeholderToId) {
  let result = text;
  const mentions = [];

  for (const [placeholder, authorId] of Object.entries(placeholderToId)) {
    if (result.includes(placeholder)) {
      const userId = authorId.replace('@c.us', '').replace(':8', '');
      result = result.replaceAll(placeholder, `@${userId}`);
      mentions.push(authorId);
    }
  }

  return { text: result, mentions };
}

async function generateSummary(conversationText, placeholderList) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: `Summarize the following WhatsApp conversation. Be concise and chronological.
When referring to users, use their exact placeholder (${placeholderList}).
Example: "<<U1>> asked about X, and <<U2>> suggested Y."
Respond in Spanish.`,
      },
      {
        role: 'user',
        content: conversationText,
      },
    ],
  });

  return response.choices[0]?.message?.content || 'No se pudo generar el resumen.';
}

async function summarizeChat(message) {
  const chat = await message.getChat();
  if (!chat.isGroup) return;

  const args = message.body.trim().split(/\s+/);
  const count = parseMessageCount(args);

  await message.reply(`Generating summary of last ${count} messages...`);

  const messages = await chat.fetchMessages({ limit: count + 1 });

  const toSummarize = messages.filter(
    (msg) => msg.id._serialized !== message.id._serialized
  );

  if (toSummarize.length === 0) {
    return message.reply('No messages to summarize.');
  }

  const { placeholderToId, idToPlaceholder } = buildAuthorMap(toSummarize);
  const conversationText = formatMessagesForSummary(toSummarize, idToPlaceholder);

  if (!conversationText) {
    return message.reply('No text content found in recent messages.');
  }

  try {
    const placeholderList = Object.keys(placeholderToId).join(', ');
    const summary = await generateSummary(conversationText, placeholderList);
    const { text, mentions } = replacePlaceholdersWithMentions(summary, placeholderToId);

    const contacts = await Promise.all(
      mentions.map((id) => client.getContactById(id))
    );

    await chat.sendMessage(text, { mentions: contacts });
  } catch (error) {
    console.error('Summary generation failed:', error);
    await message.reply('Failed to generate summary. Please try again.');
  }
}

client.on('message_create', async (message) => {
  if (!message.fromMe) return;
  if (!message.body.trim().startsWith('!summarize')) return;
  await summarizeChat(message);
});

client.on('ready', () => {
  console.log('WhatsApp client is ready.');
});

client.initialize();
