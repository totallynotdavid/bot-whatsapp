async function execute(ctx) {
  const { parsed, client, message } = ctx;
  const { args } = parsed;

  if (args.length !== 1) {
    return { text: '🤖 El comando no es válido. Por favor, envía el enlace de invitación al grupo usando el formato correcto:\n\n#join https://chat.whatsapp.com/TuCodigoDeInvitacion' };
  }

  const inviteLink = args[0];

  if (!inviteLink.startsWith('https://chat.whatsapp.com/')) {
    return { text: '🤖 El enlace de invitación que mandaste no parece válido. Por favor, verifica el enlace e inténtalo de nuevo.' };
  }

  const inviteCode = inviteLink.split('https://chat.whatsapp.com/')[1];

  try {
    const joinedGroupId = await client.acceptInvite(inviteCode);
    const joinedGroup = await client.getChatById(joinedGroupId);
    await joinedGroup.sendMessage('¡Hey! Soy un bot 🤖 y me acabo de unir a este grupo. Para terminar de configurar todo, usa el comando #addgroup para activarme.');
    return { text: '🤖 ¡Listo! Me acabo de unir al grupo.' };
  } catch (err) {
    console.error('Error joining group:', err);
    return { text: '🤖 No me he podido unir al grupo. Asegúrate de que el enlace de invitación sea correcto y de que aún esté activo.' };
  }
}

module.exports = { execute };

