const supabaseCommunicationModule = require(
  `../../lib/api/supabaseCommunicationModule.js`
);
const { refreshDatabase } = require(`../../lib/api/gdrive.js`);

const isValidNumber = (numStr) => {
  const num = Number(numStr);
  if (!Number.isInteger(num)) {
    throw new Error(`Invalid number`);
  }
  return num;
};

async function handleUpgradeGroupToPremium(
  stringifyMessage,
  chat,
  message,
  refreshDataCallback,
  robotEmoji,
  senderNumber,
  prefix,
  prefix_admin
) {
  if (!chat.id || !chat.name) {
    await message.reply(`${robotEmoji} Una de las variables es undefined.`);
    return;
  }

  if (stringifyMessage.length === 1) {
    try {
      await supabaseCommunicationModule.addPremiumGroup(
        chat.id._serialized,
        chat.name,
        senderNumber
      );
      await refreshDataCallback();
      await message.reply(
        `${robotEmoji} Chat registrado. Ya puedes usar los comandos en este chat 🎉.\n\nUsa ${prefix}help o ${prefix_admin}help para ver la lista de comandos.`
      );
    } catch (error) {
      await message.reply(
        `${robotEmoji} Error registrando el chat: ${error.message}`
      );
    }
  } else {
    await message.reply(`${robotEmoji} Solo envía el comando.`);
  }
}

async function handleUpgradeUserToPremium(
  senderNumber,
  ownerNumber,
  quotedMessage,
  stringifyMessage,
  message,
  robotEmoji,
  prefix_admin
) {
  if (senderNumber !== `${ownerNumber}@c.us`) {
    await message.reply(
      `${robotEmoji} Este comando solo está disponible para el propietario.`
    );
    return;
  }

  const handleAddUser = async (userId, customerName, days) => {
    console.log(
      `Adding user ${userId} for ${days} days at ${new Date().toISOString()}`
    );
    try {
      await supabaseCommunicationModule.addPremiumUser(
        userId,
        customerName,
        days
      );
      await message.reply(
        `${robotEmoji} Se han añadido ${days} días de premium a ${customerName}.`
      );
    } catch (error) {
      console.error(
        `Error adding user at ${new Date().toISOString()}: ${error.message}`
      );
      await message.reply(`${robotEmoji} Error añadiendo el usuario.`);
    }
  };

  try {
    if (quotedMessage && stringifyMessage.length === 3) {
      const days = isValidNumber(stringifyMessage[2]);
      const customerName = stringifyMessage[1];
      await handleAddUser(quotedMessage.author, customerName, days);
    } else if (
      stringifyMessage.length === 4 &&
      message.mentionedIds.length === 1
    ) {
      const days = isValidNumber(stringifyMessage[3]);
      const customerName = stringifyMessage[2];
      await handleAddUser(message.mentionedIds[0], customerName, days);
    } else {
      await message.reply(
        `${robotEmoji} Responde a un mensaje o menciona a alguien para obtener su ID. Recuerda que el comando es:\n\n${prefix_admin}addpremium <nombre> <días>\n\no\n\n${prefix_admin}addpremium <mencion> <nombre> <días>.`
      );
    }
  } catch (error) {
    console.error(`Error handling add user command.`, error.message);
    await message.reply(
      `${robotEmoji} Por favor, proporciona un número válido de días.`
    );
  }
}

async function handleRefreshLocalDataFromDatabase(
  senderNumber,
  ownerNumber,
  stringifyMessage,
  message,
  robotEmoji,
  refreshDataCallback
) {
  if (senderNumber !== `${ownerNumber}@c.us`) {
    await message.reply(
      `${robotEmoji} Este comando solo está disponible para el propietario.`
    );
    return;
  }

  if (stringifyMessage[1] === `users`) {
    await refreshDataCallback();
    await message.reply(
      `${robotEmoji} Genial, se han actualizado manualmente los usuarios.`
    );
  } else if (stringifyMessage[1] === `db`) {
    await message.reply(
      `${robotEmoji} Actualizando datos... Este proceso puede tardar unos 3 minutos.`
    );
    try {
      const refreshMessage = await refreshDatabase();
      await message.reply(refreshMessage);
    } catch (error) {
      await message.reply(
        `${robotEmoji} Error actualizando la base de datos: ${error.message}`
      );
    }
  } else {
    await message.reply(
      `${robotEmoji} ¿Estás seguro de que ese comando existe?`
    );
  }
}

module.exports = {
  handleUpgradeGroupToPremium,
  handleUpgradeUserToPremium,
  handleRefreshLocalDataFromDatabase,
};
