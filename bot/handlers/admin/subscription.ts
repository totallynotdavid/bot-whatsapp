function formatPhoneNumber(number) {
  const cleanedNumber = number.replace('@c.us', '');
  const countryCode = cleanedNumber.slice(0, 2);
  const phoneNumber = cleanedNumber.slice(2);

  const formattedPhoneNumber = `${countryCode} ${phoneNumber
    .match(/\d{1,3}/g)
    .join(' ')}`;

  return formattedPhoneNumber;
}

async function execute(ctx) {
  const { parsed, cache, client } = ctx;
  const { sender } = parsed;

  // Get user info from cache
  const userInfo = cache.getUser(sender.phone);

  if (!userInfo) {
    return { text: '🤖 No encontramos información de tu suscripción.' };
  }

  const { phone_number, premium_expiry } = userInfo;
  const formattedExpirationDate = new Date(premium_expiry).toLocaleDateString();
  const registeredGroups = cache.getGroupsByContact(phone_number);
  const formattedPhoneNumber = formatPhoneNumber(phone_number);

  let message = '🤖 *Información de tu suscripción*:\n\n';
  message += `📞 Número de teléfono: ${formattedPhoneNumber}\n`;
  message += `🗓️ Fecha de expiración: ${formattedExpirationDate}\n`;
  message += `👥 Grupos registrados:\n`;

  const validGroups = [];
  let orphanedGroupsCount = 0;

  for (const group of registeredGroups) {
    try {
      const chatInfo = await client.getChatById(group.group_id);
      validGroups.push(`- ${chatInfo.name}`);
    } catch (error) {
      console.log(
        `Error fetching chat info for group ${group.group_id}: ${error.message}`
      );
      orphanedGroupsCount++;
    }
  }

  if (validGroups.length === 0) {
    message += '- No hay grupos registrados actualmente\n';
  } else {
    message += validGroups.join('\n');
  }

  if (orphanedGroupsCount > 0) {
    message += `\n\nEncontramos ${orphanedGroupsCount} grupo(s) huérfano(s) que probablemente no existen más. Contáctanos si crees que hay un problema.`;
  }

  return { text: message };
}

module.exports = { execute };

