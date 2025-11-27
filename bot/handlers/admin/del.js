async function execute(ctx) {
  const { parsed, client, message } = ctx;
  const { chat } = parsed;

  if (!chat.isGroup) {
    return { text: '🤖 Este comando solo funciona en grupos.' };
  }

  // Check if bot is admin
  const participants = chat.participants;
  const botId = `${client.info.wid.user}@c.us`;
  const isBotAdmin = participants.some(p => p.id._serialized === botId && p.isAdmin);

  if (!isBotAdmin) {
    return { text: '🤖 Es necesario que el bot sea administrador del grupo.' };
  }

  const quotedMessage = await message.getQuotedMessage();

  if (quotedMessage) {
    const quotedAuthor = quotedMessage.author;
    if (quotedAuthor === botId) {
      return { text: '🤖 Cómo te atreves.' };
    }
    try {
      await quotedMessage.delete(true);
      return { text: '🤖 Mensaje eliminado.' };
    } catch (err) {
      console.error('Error deleting message:', err);
      return { text: '🤖 Error eliminando el mensaje.' };
    }
  } else {
    return { text: '🤖 Para eliminar un mensaje, simplemente responde a él.' };
  }
}

module.exports = { execute };