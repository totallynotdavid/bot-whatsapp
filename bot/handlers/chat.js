/**
 * Chat Command Handler
 * 
 * Handles AI-powered chat conversations with automatic summarization
 * for long conversation histories.
 */

import OpenAI from 'openai';

/**
 * System prompt for chat conversations
 */
const CHAT_SYSTEM_PROMPT = {
  role: 'system',
  content: 'Act as a succinct assistant. Talk in Spanish. No inappropriate content.',
};

/**
 * Maximum conversation length before triggering summarization
 */
const MAX_CONVERSATION_LENGTH = 5000;

/**
 * Maximum tokens for OpenAI responses
 */
const MAX_TOKENS = 800;

/**
 * Maximum user message length
 */
const MAX_USER_MSG_LENGTH = 600;

/**
 * Trims user message to maximum length
 * @param {string} message - Message to trim
 * @returns {string} Trimmed message
 */
function trimUserMessage(message) {
  if (message.length > MAX_USER_MSG_LENGTH) {
    return message.substring(0, MAX_USER_MSG_LENGTH);
  }
  return message;
}

/**
 * Formats messages for OpenAI chat API
 * @param {Array} history - Previous messages
 * @param {string} query - Current user query
 * @returns {Array} Formatted messages
 */
function formatMessagesForChat(history, query) {
  return [
    CHAT_SYSTEM_PROMPT,
    ...history.map((msg) => ({
      role: msg.role,
      content: trimUserMessage(msg.content),
    })),
    { role: 'user', content: trimUserMessage(query) },
  ];
}

/**
 * Processes raw database messages into OpenAI format
 * @param {Array} rawMessages - Messages from database
 * @returns {Array} Processed messages
 */
function processMessages(rawMessages) {
  return rawMessages.map((m) => ({
    role: m.sender === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));
}

/**
 * Calculates total character length of messages
 * @param {Array} messages - Array of messages
 * @returns {number} Total length
 */
function calculateTotalLength(messages) {
  return messages.reduce((total, msg) => total + msg.content.length, 0);
}

/**
 * Generates summary of conversation history
 * @param {OpenAI} openai - OpenAI client
 * @param {Array} messages - Messages to summarize
 * @returns {Promise<string>} Summary text
 */
async function generateSummary(openai, messages) {
  const conversationText = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n');

  const summaryPrompt = [
    {
      role: 'system',
      content:
        'You are a meeting recorder. Summarize input ({ID}: {message}) in Spanish. Engaging, chronological, concise. Attribute to speakers.',
    },
    { role: 'user', content: conversationText },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-0125',
      messages: summaryPrompt,
      max_tokens: MAX_TOKENS,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating summary:', error);
    return null;
  }
}

/**
 * Calls OpenAI API with conversation context
 * @param {OpenAI} openai - OpenAI client
 * @param {Array} messages - Formatted messages
 * @returns {Promise<string|null>} AI response or null on error
 */
async function callOpenAI(openai, messages) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-0125',
      messages: messages,
      max_tokens: MAX_TOKENS,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error with OpenAI API request:', error);
    return null;
  }
}

/**
 * Execute chat command
 * 
 * @param {Object} ctx - Command context
 * @param {Object} ctx.parsed - Parsed command information
 * @param {string[]} ctx.parsed.args - Command arguments (user query)
 * @param {Object} ctx.parsed.sender - Sender information
 * @param {string} ctx.parsed.sender.phone - Sender phone number
 * @param {Object} ctx.parsed.chat - Chat information
 * @param {string} ctx.parsed.chat.id - Chat ID
 * @param {Object} ctx.db - Database interface
 * @param {Object} ctx.config - Configuration
 * @returns {Promise<{text: string}>} Chat response
 */
async function execute(ctx) {
  try {
    const { parsed, db, config } = ctx;
    const { args, sender, chat } = parsed;

    // Validate query
    const query = args.join(' ').trim();
    if (!query) {
      return { text: '¿Sobre qué quieres conversar?' };
    }

    // Create conversation ID
    const conversationId = `${chat.id}_${sender.phone}`;

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });

    // Fetch conversation history (last 50 messages)
    const rawMessages = await db.getMessages(conversationId, 50);
    const processedMessages = processMessages(rawMessages);

    // Prepare messages for OpenAI
    let messages;
    if (processedMessages.length === 0) {
      // No history - just send query
      messages = formatMessagesForChat([], query);
    } else {
      const totalLength = calculateTotalLength(processedMessages);

      // Check if summarization is needed (>50 messages or >5000 chars)
      if (processedMessages.length > 50 || totalLength > MAX_CONVERSATION_LENGTH) {
        // Generate summary
        const summary = await generateSummary(openai, processedMessages);
        
        if (summary) {
          messages = formatMessagesForChat(
            [{ role: 'system', content: `Summary: ${summary}` }],
            query
          );
        } else {
          // Fallback: use recent messages only
          messages = formatMessagesForChat(
            processedMessages.slice(-10),
            query
          );
        }
      } else {
        // Use full history
        messages = formatMessagesForChat(processedMessages, query);
      }
    }

    // Call OpenAI
    const chatResponse = await callOpenAI(openai, messages);

    // Store messages
    if (chatResponse) {
      await Promise.all([
        db.addMessage(conversationId, 'user', query),
        db.addMessage(conversationId, 'assistant', chatResponse),
      ]);
      return { text: chatResponse };
    } else {
      // Store failed attempt
      await Promise.all([
        db.addMessage(conversationId, 'user', query),
        db.addMessage(conversationId, 'assistant', 'No response'),
      ]);
      return {
        text: 'Disculpa, no pude generar una respuesta. ¿Podrías intentar de nuevo?',
      };
    }
  } catch (err) {
    console.error('Chat command error:', err);
    return {
      text: 'Ocurrió un error al procesar tu solicitud.',
    };
  }
}

export { execute, processMessages, calculateTotalLength, formatMessagesForChat };

