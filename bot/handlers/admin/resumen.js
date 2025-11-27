const { callOpenAI } = require("../../services/openai");
const { getSummaryPrompt } = require("../../utils/promptManager");

async function summarizeMessages(messages) {
  try {
    const processedMessages = messages.reduce((acc, msg) => {
      if (msg.content && msg.content.trim()) {
        if (acc.length && acc[acc.length - 1].author === msg.author) {
          acc[acc.length - 1].content += ` ${msg.content}`;
        } else {
          acc.push({ author: msg.author, content: msg.content });
        }
      }
      return acc;
    }, []);

    const conversationText = processedMessages
      .map((msg) => `${msg.author}: ${msg.content}`)
      .join("\n");

    const summaryPrompt = getSummaryPrompt(conversationText);

    const summary = await callOpenAI(summaryPrompt);

    return summary;
  } catch (error) {
    console.error("Error in summarizeMessages:", error);
    throw error;
  }
}

async function execute(ctx) {
  const { parsed, db } = ctx;
  const { chat, sender } = parsed;

  if (!chat.isGroup) {
    return { text: '🤖 Este comando solo funciona en grupos.' };
  }

  const conversationId = `${chat.id}_${sender.phone}`;

  try {
    // Fetch all messages (set high limit)
    const messages = await db.getMessages(conversationId, 10000);

    if (messages.length === 0) {
      return { text: '🤖 No hay mensajes para resumir.' };
    }

    // Convert to format expected by summarizeMessages
    const formattedMessages = messages.map(msg => ({
      author: msg.sender,
      content: msg.content,
    }));

    const summary = await summarizeMessages(formattedMessages);

    return { text: `🤖 Resumen del chat:\n\n${summary}` };
  } catch (err) {
    console.error('Error summarizing chat:', err);
    return { text: '🤖 Error generando el resumen.' };
  }
}

module.exports = { execute };