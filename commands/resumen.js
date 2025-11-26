const { callOpenAI } = require("../services/openai");
const { getSummaryPrompt } = require("../utils/promptManager");

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

module.exports = {
  summarizeMessages,
};
