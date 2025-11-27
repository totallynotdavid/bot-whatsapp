async function execute(ctx) {
  const { parsed, client } = ctx;
  const { chat, sender } = parsed;

  // Check if in group
  if (!chat.isGroup) {
    return { text: '🤖 Este comando solo funciona en grupos.' };
  }

  try {
    const og = await ctx.message.getQuotedMessage();
    const participants = chat.participants;
    const chunkSize = 100;
    const delayBetweenMessages = 3000; // 3 seconds delay between messages

    for (let i = 0; i < participants.length; i += chunkSize) {
      let text = "";
      let mentions = [];

      // Looping through all the members in chunks
      const chunk = participants.slice(i, i + chunkSize);
      for (let participant of chunk) {
        const contact = await client.getContactById(participant.id._serialized);
        mentions.push(contact);
        text += `@${participant.id.user} `;
      }

      // Send message for this chunk
      if (ctx.message.hasQuotedMsg) {
        await og.reply(text, null, { mentions });
      } else {
        await chat.sendMessage(text, { mentions });
      }

      // Add delay between chunks
      if (i + chunkSize < participants.length) {
        await delay(delayBetweenMessages);
      }
    }

    return { text: `🤖 Este mensaje fue solicitado por ${sender.name}` };
  } catch (err) {
    console.error('Error in mention everyone:', err);
    return { text: "🤖 Hubo un error al mencionar a todos los miembros del grupo." };
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = { execute };