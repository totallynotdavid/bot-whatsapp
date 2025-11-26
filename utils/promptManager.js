const textUtils = require("./text");

function getChatSystemPrompt() {
  return {
    role: "system",
    content:
      "Act as a succinct assistant. Talk in Spanish. No inappropriate content.",
  };
}

function formatMessagesForChat(messages, query) {
  return [
    getChatSystemPrompt(),
    ...messages.map((msg) => ({
      role: msg.role,
      content: textUtils.trimUserMessage(msg.content),
    })),
    { role: "user", content: textUtils.trimUserMessage(query) },
  ];
}

function processMessages(messages) {
  const processedMessages = messages.map((m) => ({
    role:
      m.sender === "system"
        ? "system"
        : m.sender === "user"
          ? "user"
          : "assistant",
    content: m.message,
  }));

  let foundSummary = false;
  const splitMessages = [];

  for (const message of processedMessages) {
    if (message.role === "system" && message.content.startsWith("Summary: ")) {
      foundSummary = true;
      splitMessages.push([]);
    }

    if (foundSummary) {
      splitMessages[splitMessages.length - 1].push(message);
    } else {
      if (splitMessages.length === 0) splitMessages.push([]);
      splitMessages[0].push(message);
    }
  }

  return splitMessages;
}

function getSummaryPrompt(text) {
  return [
    {
      role: "system",
      content:
        "You are a meeting recorder. Summarize input ({ID}: {message}) in Spanish. Engaging, chronological, concise. Attribute to speakers.",
    },
    { role: "user", content: text },
  ];
}

module.exports = {
  formatMessagesForChat,
  processMessages,
  getSummaryPrompt,
};
