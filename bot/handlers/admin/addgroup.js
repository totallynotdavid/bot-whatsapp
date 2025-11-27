async function execute(ctx) {
  const { parsed, db, cache } = ctx;
  const { chat, sender } = parsed;

  if (!chat.isGroup) {
    return { text: '🤖 Este comando solo funciona en grupos.' };
  }

  try {
    await db.addPremiumGroup(chat.id, chat.name, sender.phone);
    
    // Update cache immediately
    cache.setGroup(chat.id, sender.phone, true);
    
    return { text: `🤖 Chat registrado. Ya puedes usar los comandos en este chat 🎉.\n\nUsa /help o #help para ver la lista de comandos.` };
  } catch (err) {
    console.error('Error adding premium group:', err);
    return { text: `🤖 Error registrando el chat: ${err.message}` };
  }
}

module.exports = { execute };