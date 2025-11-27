async function execute(ctx) {
  const { parsed, db, cache, config } = ctx;
  const { sender } = parsed;

  // Check if owner
  if (sender.phone !== `${config.ownerNumber}@c.us`) {
    return { text: '🤖 Este comando solo está disponible para el propietario.' };
  }

  const subCommand = parsed.args[0];

  if (subCommand === 'users') {
    try {
      const [users, groups] = await Promise.all([
        db.getPremiumUsers(),
        db.getPremiumGroups(),
      ]);

      cache.loadUsers(users);
      cache.loadGroups(groups);

      const stats = cache.stats();
      return { text: `🤖 Genial, se han actualizado manualmente los usuarios. ${stats.users} usuarios, ${stats.groups} grupos.` };
    } catch (err) {
      console.error('Error refreshing cache:', err);
      return { text: '🤖 Error actualizando los datos.' };
    }
  } else if (subCommand === 'db') {
    // For db refresh, perhaps call some function, but for now, just refresh users
    return { text: '🤖 Actualización de DB no implementada aún.' };
  } else {
    return { text: '🤖 ¿Estás seguro de que ese comando existe?' };
  }
}

module.exports = { execute };

