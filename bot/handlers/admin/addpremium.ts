async function execute(ctx) {
  const { parsed, db, cache, config, message } = ctx;
  const { sender, args } = parsed;

  if (sender.phone !== `${config.ownerNumber}@c.us`) {
    return { text: '🤖 Este comando solo está disponible para el propietario.' };
  }

  try {
    let userId, customerName, days;

    const quotedMessage = await message.getQuotedMessage();

    if (quotedMessage && args.length >= 2) {
      userId = quotedMessage.author;
      customerName = args[0];
      days = parseInt(args[1]);
    } else if (message.mentionedIds && message.mentionedIds.length === 1 && args.length >= 2) {
      userId = message.mentionedIds[0];
      if (args[0].startsWith('@')) {
        customerName = args[1];
        days = parseInt(args[2]);
      } else {
        customerName = args[0];
        days = parseInt(args[1]);
      }
    } else {
      return { text: '🤖 Responde a un mensaje o menciona a alguien para obtener su ID. Recuerda que el comando es:\n\n#addpremium <nombre> <días>\n\no\n\n#addpremium <mencion> <nombre> <días>.' };
    }

    if (isNaN(days)) {
      return { text: '🤖 Por favor, proporciona un número válido de días.' };
    }

    await db.addPremiumUser(userId, customerName, days);

    // Update cache immediately
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    cache.setUser(userId, expiry);

    return { text: `🤖 Se han añadido ${days} días de premium a ${customerName}.` };
  } catch (err) {
    console.error('Error adding premium user:', err);
    return { text: '🤖 Error añadiendo el usuario.' };
  }
}

module.exports = { execute };

