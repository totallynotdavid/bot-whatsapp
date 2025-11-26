async function handleGlobalMessage(
  client,
  paidUsers,
  senderNumber,
  ownerNumber,
  message,
  robotEmoji,
  stringifyMessage
) {
  if (senderNumber !== `${ownerNumber}@c.us`) {
    await message.reply(
      `${robotEmoji} Este comando solo está disponible para el propietario.`
    );
    return;
  }

  const globalMessage = stringifyMessage.slice(1).join(` `);

  if (!globalMessage) {
    await message.reply(
      `${robotEmoji} Por favor, proporciona el mensaje que deseas enviar.`
    );
    return;
  }

  try {
    const cooldownMs = 5000; // 5 seconds
    for (const user of paidUsers) {
      const userNumber = user.phone_number;
      const contactId = `userNumber`;

      try {
        await client.sendMessage(contactId, globalMessage);
      } catch (error) {
        message.reply(`Error al enviar mensaje a ${userNumber}`);
        console.error(`Error sending message to ${userNumber}:`, error);
      }

      await new Promise((resolve) => setTimeout(resolve, cooldownMs));
    }

    await message.reply(
      `${robotEmoji} Mensaje enviado a todos los usuarios de pago.`
    );
  } catch (error) {
    console.error(`Error al enviar mensajes globales:`, error);
    await message.reply(
      `${robotEmoji} Ocurrió un error al enviar los mensajes globales.`
    );
  }
}

module.exports = { handleGlobalMessage };
