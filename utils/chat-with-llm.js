const { callOpenAI } = require("../services/openai");
const { fetchLastNMessages, addMessage } = require("../services/supabase");
const {
  formatMessagesForChat,
  getSummaryPrompt,
  processMessages,
} = require("./promptManager");
const config = require("../config");

async function handleChatLogic(senderId, groupId, query) {
  const conversation_id = `${groupId}_${senderId}`;

  const rawMessages = await fetchLastNMessages(senderId, groupId, 5);
  const processedMessages = processMessages(rawMessages);

  let messages;
  if (processedMessages.length === 0 || processedMessages[0].length === 0) {
    messages = formatMessagesForChat([], query);
  } else {
    const lastConversation = processedMessages[processedMessages.length - 1];
    const totalLength = lastConversation.reduce(
      (total, msg) => total + msg.content.length,
      0
    );

    if (totalLength > config.MAX_CONVERSATION_LENGTH) {
      const conversationText = lastConversation
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n");
      const summaryPrompt = getSummaryPrompt(conversationText);
      const summary = await callOpenAI(summaryPrompt);
      messages = formatMessagesForChat(
        [{ role: "system", content: `Summary: ${summary}` }],
        query
      );
    } else {
      messages = formatMessagesForChat(lastConversation, query);
    }
  }

  const chatResponse = await callOpenAI(messages);

  if (chatResponse) {
    await Promise.all([
      addMessage(senderId, groupId, "user", query, conversation_id),
      addMessage(senderId, groupId, "assistant", chatResponse, conversation_id),
    ]);
    return chatResponse;
  } else {
    await Promise.all([
      addMessage(senderId, groupId, "user", query, conversation_id),
      addMessage(
        senderId,
        groupId,
        "assistant",
        "No response",
        conversation_id
      ),
    ]);
    return "Disculpa, no pude generar una respuesta. ¿Podrías intentar de nuevo?";
  }
}

module.exports = {
  handleChatLogic,
};
