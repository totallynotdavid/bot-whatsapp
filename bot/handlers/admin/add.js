async function execute(ctx) {
  const { parsed, client, message } = ctx;
  const { chat } = parsed;

  if (!chat.isGroup) {
    return { text: '🤖 Este comando solo funciona en grupos.' };
  }

  const quotedMessage = await message.getQuotedMessage();

  if (!quotedMessage) {
    return { text: '🤖 Este comando debe ser usado como respuesta a un mensaje que contenga un contacto.' };
  }

  if (!quotedMessage.vCards || quotedMessage.vCards.length === 0) {
    return { text: '🤖 El mensaje al que estás respondiendo no contiene un contacto.' };
  }

  // Limit to 3 contacts
  if (quotedMessage.vCards.length > 3) {
    return { text: '🤖 No se pueden agregar más de 3 contactos a la vez.' };
  }

  const contactIds = [];

  for (const vCard of quotedMessage.vCards) {
    const vCardLines = vCard.split('\n');
    const contactIdLine = vCardLines.find((line) =>
      line.startsWith('TEL;type=CELL;waid=')
    );
    const contactId = contactIdLine
      ? contactIdLine.split(':')[1].replace(/\+/g, '').replace(/ /g, '')
      : null;

    if (!contactId) {
      return { text: '🤖 No se pudo obtener el ID del contacto desde el mensaje citado.' };
    }

    contactIds.push(`${contactId}@c.us`);
  }

  // Check if bot is admin
  const participants = chat.participants;
  const botId = `${client.info.wid.user}@c.us`;
  const isBotAdmin = participants.some(p => p.id._serialized === botId && p.isAdmin);

  if (!isBotAdmin) {
    return { text: '🤖 Necesito permisos de administrador en el grupo para continuar.' };
  }

  try {
    await chat.addParticipants(contactIds);
    return { text: '🤖 Los usuarios han sido agregados al grupo.' };
  } catch (err) {
    console.error('Error adding participants:', err);
    return { text: '🤖 No se pudo agregar a los usuarios al grupo. Por favor, verifica que los contactos sean válidos y que no estén ya en el grupo.' };
  }
}

module.exports = { execute };