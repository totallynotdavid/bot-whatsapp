const config = require("../config");

function trimUserMessage(
  userMessage,
  maxLength = config.MAX_USER_MSG_LENGTH,
  trimFromStart = false
) {
  if (userMessage.length <= maxLength) return userMessage;

  if (trimFromStart) {
    return userMessage.substring(userMessage.length - maxLength);
  } else {
    return userMessage.substring(0, maxLength) + "...";
  }
}

module.exports = {
  trimUserMessage,
};
