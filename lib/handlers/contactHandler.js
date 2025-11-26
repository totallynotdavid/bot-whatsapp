const lastContactRequestTime = {};

async function handleContactRequest(client, message, robotEmoji, ownerNumber) {
  const senderNumber = message.id.participant || message.id.remote;
  const cooldownDuration = 60 * 60 * 1000; // 1 hour in milliseconds
  const currentTime = Date.now();

  if (
    lastContactRequestTime[senderNumber] &&
    currentTime - lastContactRequestTime[senderNumber] < cooldownDuration
  ) {
    return;
  }

  const actualOwnerNumber = `${ownerNumber}@c.us`;
  const contact = await client.getContactById(actualOwnerNumber);
  const messageContent = `${robotEmoji} Hola, parece que no eres un usuario de pago. Por favor, envía un mensaje al propietario del bot (a continuación) para solicitar acceso.`;

  await client.sendMessage(message.id.remote, messageContent);
  await client.sendMessage(message.id.remote, contact);

  lastContactRequestTime[senderNumber] = currentTime; // Update the last request
}

module.exports = {
  handleContactRequest,
};
