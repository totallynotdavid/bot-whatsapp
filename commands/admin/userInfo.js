function formatPhoneNumber(number) {
  const cleanedNumber = number.replace(`@c.us`, ``);
  const countryCode = cleanedNumber.slice(0, 2);
  const phoneNumber = cleanedNumber.slice(2);

  const formattedPhoneNumber = `${countryCode} ${phoneNumber
    .match(/\d{1,3}/g)
    .join(` `)}`;

  return formattedPhoneNumber;
}

async function getUserInfo(
  client,
  senderNumber,
  robotEmoji,
  paidUsers,
  premiumGroups
) {
  const userInfo = paidUsers.find((user) => user.phone_number === senderNumber);

  if (!userInfo) {
    return `${robotEmoji} No encontramos información de tu suscripción.`;
  }

  const { phone_number, premium_expiry } = userInfo;
  const formattedExpirationDate = new Date(premium_expiry).toLocaleDateString();
  const registeredGroups = premiumGroups.filter(
    (group) => group.contact_number === phone_number
  );
  const formattedPhoneNumber = formatPhoneNumber(phone_number);

  let message = `${robotEmoji} *Información de tu suscripción*:\n\n`;
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
    message += `- No hay grupos registrados actualmente\n`;
  } else {
    message += validGroups.join(`\n`);
  }

  if (orphanedGroupsCount > 0) {
    message += `\n\nEncontramos ${orphanedGroupsCount} grupo(s) huérfano(s) que probablemente no existen más. Contáctanos si crees que hay un problema.`;
  }

  return message;
}

module.exports = { getUserInfo };
