/**
 * Extracts structured data from an array of WhatsApp messages.
 * @param {Array} messages - The array of raw WhatsApp message objects.
 * @returns {Array} An array of structured message data objects.
 */
function extractMessageData(messages) {
  return messages.map(extractSingleMessageData);
}

/**
 * Extracts structured data from a single WhatsApp message.
 * @param {Object} msg - The raw WhatsApp message object.
 * @returns {Object} A structured message data object.
 */
function extractSingleMessageData(msg) {
  console.log("id:", msg._data.id);
  console.log("id:", msg.id.participant);

  let extractedData = {
    type: msg.type,
    timestamp: msg.timestamp,
    from: msg.from,
    author: msg.author,
  };

  switch (msg.type) {
    case "chat":
      extractedData.content = msg.body;
      break;
    case "image":
      extractedData.content = msg.caption || "";
      extractedData.hasMedia = true;
      extractedData.mediaUrl = msg._data.deprecatedMms3Url;
      break;
    case "sticker":
      extractedData.content = "";
      extractedData.hasMedia = true;
      extractedData.mediaUrl = msg._data.deprecatedMms3Url;
      break;
    default:
      extractedData.content = msg.body || "";
  }

  return extractedData;
}

module.exports = {
  extractMessageData,
  extractSingleMessageData,
};
