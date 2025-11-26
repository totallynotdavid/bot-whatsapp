/* Here we use let instead of const to a avoid the following error: */
/* TypeError: Assignment to constant variable. */

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function mentionEveryone(chat, client, message, senderName) {
  try {
    const og = await message.getQuotedMessage();
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
      if (message.hasQuotedMsg) {
        await og.reply(text, null, { mentions });
      } else {
        await chat.sendMessage(text, { mentions });
      }

      // Add delay between chunks
      if (i + chunkSize < participants.length) {
        await delay(delayBetweenMessages);
      }
    }

    await message.reply(`🤖 Este mensaje fue solicitado por ${senderName}`);
  } catch (err) {
    console.error(err);
    await message.reply(
      "🤖 Hubo un error al mencionar a todos los miembros del grupo."
    );
  }
}

module.exports = {
  mentionEveryone,
};
