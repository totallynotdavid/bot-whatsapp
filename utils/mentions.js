async function processMentions(summary, chat, client) {
  const phoneNumberRegex = /(\d{10,})/g;
  const mentionedNumbers = summary.match(phoneNumberRegex) || [];
  let processedSummary = summary;
  const mentions = [];

  for (const phoneNumber of mentionedNumbers) {
    const participantId = `${phoneNumber}@c.us`;
    const participant = chat.participants.find(
      (p) => p.id._serialized === participantId
    );

    if (participant) {
      const contact = await client.getContactById(participantId);
      const mentionName = contact.pushname || contact.name || phoneNumber;

      processedSummary = processedSummary.replace(
        new RegExp(phoneNumber, "g"),
        `@${mentionName}`
      );

      mentions.push(contact);
    }
  }

  return { processedSummary, mentions };
}

module.exports = {
  processMentions,
};
