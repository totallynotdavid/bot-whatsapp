const { Configuration, OpenAIApi } = require("openai");
const config = require("../config");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function callOpenAI(messages, maxTokens = config.MAX_TOKENS) {
  try {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo-0125",
      messages: messages,
      max_tokens: maxTokens,
    });

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error with OpenAI API request:", error);
    return null;
  }
}

module.exports = {
  callOpenAI,
};
