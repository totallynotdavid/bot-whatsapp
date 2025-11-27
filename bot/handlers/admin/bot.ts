async function execute(ctx) {
  const { parsed, db, cache, message } = ctx;
  const { chat, args } = parsed;

  if (!chat.isGroup) {
    return { text: '🤖 Este comando solo funciona en grupos.' };
  }

  if (args.length !== 1) {
    return { text: '🤖 ¿Y qué quieres que haga?' };
  }

  const botCommand = args[0];

  try {
    const groupId = chat.id;

    if (botCommand === 'on') {
      const existing = await db.getPremiumGroup(groupId);
      if (existing && existing.isActive) {
        return { text: '🤖 Este grupo ya tiene el bot activado.' };
      }
      await db.updateGroupStatus(groupId, true);
      cache.setGroup(groupId, existing ? existing.contact_number : '', true);
      return { text: '🤖 El bot se ha activado para este grupo.' };
    } else if (botCommand === 'off') {
      const existing = await db.getPremiumGroup(groupId);
      if (existing && !existing.isActive) {
        return { text: '🤖 El bot ya está desactivado para este grupo.' };
      }
      await db.updateGroupStatus(groupId, false);
      cache.setGroup(groupId, existing ? existing.contact_number : '', false);
      return { text: '🤖 El bot se ha desactivado para este grupo.' };
    } else {
      return { text: '🤖 Solo puedes habilitar o deshabilitar el bot.' };
    }
  } catch (err) {
    console.error('Error toggling bot:', err);
    return { text: '🤖 Error cambiando el estado del bot.' };
  }
}

module.exports = { execute };

