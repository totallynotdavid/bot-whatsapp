async function execute(ctx) {
  const { parsed, client, config, cache } = ctx;
  const { sender, args } = parsed;

  if (sender.phone !== `${config.ownerNumber}@c.us`) {
    return { text: '🤖 Este comando solo está disponible para el propietario.' };
  }

  const globalMessage = args.join(' ');

  if (!globalMessage) {
    return { text: '🤖 Por favor, proporciona el mensaje que deseas enviar.' };
  }

  try {
    const users = cache.getAllUsers(); // Need to add this method
    const cooldownMs = 5000; // 5 seconds

    let sentCount = 0;
    let errorCount = 0;

    for (const user of users) {
      const userNumber = user.phone_number;
      const contactId = userNumber;

      try {
        await client.sendMessage(contactId, globalMessage);
        sentCount++;
      } catch (error) {
        console.error(`Error sending message to ${userNumber}:`, error);
        errorCount++;
      }

      await new Promise((resolve) => setTimeout(resolve, cooldownMs));
    }

    return { text: `🤖 Mensaje enviado a ${sentCount} usuarios. Errores: ${errorCount}.` };
  } catch (err) {
    console.error('Error sending global message:', err);
    return { text: '🤖 Ocurrió un error al enviar los mensajes globales.' };
  }
}

module.exports = { execute };