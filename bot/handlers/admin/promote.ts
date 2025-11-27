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

  let userIds = [];

  if (quotedMessage) {
    userIds = [quotedMessage.author];
  } else if (message.mentionedIds && message.mentionedIds.length > 0) {
    userIds = message.mentionedIds;
  } else {
    return { text: '🤖 Para hacer a alguien admin, responde a su mensaje o menciónalo.' };
  }

  // Filter users who are not already admins
  const admins = participants.filter(p => p.isAdmin);
  const usersToPromote = userIds.filter(userId => !admins.some(admin => admin.id._serialized === userId));

  if (usersToPromote.length === 0) {
    return { text: '🤖 Este usuario ya es administrador.' };
  }

  try {
    await chat.promoteParticipants(usersToPromote);
    return { text: `🤖 Se ha añadido ${usersToPromote.length} administrador(es).` };
  } catch (err) {
    console.error('Error promoting users:', err);
    return { text: '🤖 Error cambiando roles.' };
  }
}

module.exports = { execute };

