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
    return { text: '🤖 Necesito permisos de administrador en el grupo para continuar.' };
  }

  const quotedMessage = await message.getQuotedMessage();

  let userIds = [];

  if (quotedMessage) {
    userIds = [quotedMessage.author];
  } else if (message.mentionedIds && message.mentionedIds.length > 0) {
    userIds = message.mentionedIds;
  } else {
    return { text: '🤖 Para eliminar a alguien del grupo, responde a su mensaje o menciónalo.' };
  }

  // Filter out bot
  userIds = userIds.filter(id => id !== botId);

  if (userIds.length === 0) {
    return { text: '🤖 No hay usuarios válidos para banear.' };
  }

  try {
    await chat.removeParticipants(userIds);
    const count = userIds.length;
    return { text: `🤖 ${count} usuario(s) baneado(s) exitosamente.` };
  } catch (err) {
    console.error('Error banning users:', err);
    return { text: '🤖 Hubo un error al banear a los usuarios.' };
  }
}

module.exports = { execute };