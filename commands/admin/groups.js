const supabaseCommunicationModule = require(
  `../../lib/api/supabaseCommunicationModule.js`
);
const specialDay = require(`./specialDay.js`);

/* https://github.com/pedroslopez/whatsapp-web.js/issues/2067 */
async function banUser(chat, participantId) {
  // eslint-disable-next-line
  try {
    await chat.removeParticipants([participantId]);
  } catch (error) {
    throw error;
  }
}

async function banMultipleUsers(client, chat, userIds, message, robotEmoji) {
  let totalBanned = 0;
  let totalErrors = 0;

  for (let userId of userIds) {
    if (userId === `${client.info.wid.user}:8@c.us`) {
      continue;
    }
    try {
      await banUser(chat, userId);
      totalBanned++;
    } catch (error) {
      totalErrors++;
    }
  }

  if (totalBanned > 0) {
    message.reply(
      `${robotEmoji} ${totalBanned} usuario(s) baneado(s) exitosamente.`
    );
  }
  if (totalErrors > 0) {
    message.reply(
      `${robotEmoji} Hubo problemas al banear a ${totalErrors} usuario(s).`
    );
  }
}

function handleBanUserFromGroup(
  admins,
  stringifyMessage,
  client,
  chat,
  quotedMessage,
  message,
  robotEmoji,
  banAll = false
) {
  if (
    !admins.some(
      (admin) => admin.id._serialized === `${client.info.wid.user}@c.us`
    )
  ) {
    return message.reply(
      `${robotEmoji} Necesito permisos de administrador en el grupo para continuar.`
    );
  }

  if (banAll) {
    const participants = Object.values(chat.participants);
    const userIds = participants.map(
      (participant) => participant.id._serialized
    );
    banMultipleUsers(client, chat, userIds, message, robotEmoji);
  } else {
    if (quotedMessage && stringifyMessage.length === 1) {
      const quotedAuthor = quotedMessage.author;
      if (quotedAuthor === `${client.info.wid.user}:8@c.us`) {
        message.reply(`${robotEmoji} Cómo te atreves.`);
      } else {
        banMultipleUsers(client, chat, [quotedAuthor], message, robotEmoji);
      }
    } else if (stringifyMessage.length > 1) {
      banMultipleUsers(client, chat, message.mentionedIds, message, robotEmoji);
    } else {
      message.reply(
        `${robotEmoji} Para eliminar a alguien del grupo, responde a su mensaje o menciónalo.`
      );
    }
  }
}

function handlePromoteUsersToAdmins(
  admins,
  message,
  stringifyMessage,
  quotedMessage,
  chat,
  client,
  robotEmoji
) {
  if (
    !admins.some(
      (admin) => admin.id._serialized === `${client.info.wid.user}@c.us`
    )
  ) {
    return message.reply(
      `${robotEmoji} Es necesario que el bot sea administrador del grupo.`
    );
  }

  if (stringifyMessage.length === 1 && quotedMessage) {
    processUser(
      quotedMessage.author,
      (userId) => !admins.some((admin) => admin.id._serialized === userId),
      `promoteParticipants`,
      `Se ha añadido`,
      `Este usuario ya es administrador.`
    );
  } else if (
    stringifyMessage.length > 1 &&
    message.mentionedIds &&
    !quotedMessage
  ) {
    processUser(
      message.mentionedIds,
      (userId) => !admins.some((admin) => admin.id._serialized === userId),
      `promoteParticipants`,
      `Se han añadido`,
      `Todos los usuarios mencionados ya son administradores.`,
      chat,
      message,
      robotEmoji
    );
  } else {
    message.reply(
      `${robotEmoji} Para hacer a alguien admin, responde a su mensaje o menciónalo.`
    );
  }
}

function handleDemoteUsersToParticipants(
  admins,
  message,
  stringifyMessage,
  quotedMessage,
  chat,
  client,
  robotEmoji
) {
  if (
    !admins.some(
      (admin) => admin.id._serialized === `${client.info.wid.user}@c.us`
    )
  ) {
    return message.reply(
      `${robotEmoji} Es necesario que el bot sea administrador del grupo.`
    );
  }

  if (stringifyMessage.length === 1 && quotedMessage) {
    processUser(
      quotedMessage.author,
      (userId) => admins.some((admin) => admin.id._serialized === userId),
      `demoteParticipants`,
      `Se ha eliminado`,
      `Este usuario no es administrador.`
    );
  } else if (
    stringifyMessage.length > 1 &&
    message.mentionedIds &&
    !quotedMessage
  ) {
    processUser(
      message.mentionedIds,
      (userId) => admins.some((admin) => admin.id._serialized === userId),
      `demoteParticipants`,
      `Se han eliminado`,
      `Ninguno de los usuarios mencionados es administrador.`,
      chat,
      message,
      robotEmoji
    );
  } else {
    message.reply(
      `${robotEmoji} Para quitar el rol de admin a alguien, responde a su mensaje o menciónalo.`
    );
  }
}

async function handleAddUserToGroup(admins, message, client, robotEmoji) {
  if (!message.hasQuotedMsg) {
    message.reply(
      `${robotEmoji} Este comando debe ser usado como respuesta a un mensaje que contenga un contacto.`
    );
    return;
  }

  const quotedMessage = await message.getQuotedMessage();

  if (!quotedMessage.vCards || quotedMessage.vCards.length === 0) {
    message.reply(
      `${robotEmoji} El mensaje al que estás respondiendo no contiene un contacto.`
    );
    return;
  }

  // We limit the number of contacts that can be added at once to 3 to avoid spam reports
  if (quotedMessage.vCards.length > 3) {
    message.reply(
      `${robotEmoji} No se pueden agregar más de 3 contactos a la vez.`
    );
    return;
  }

  const groupChat = await message.getChat();
  const contactIds = [];

  for (const vCard of quotedMessage.vCards) {
    const vCardLines = vCard.split(`\n`);
    const contactIdLine = vCardLines.find((line) =>
      line.startsWith(`TEL;type=CELL;waid=`)
    );
    const contactId = contactIdLine
      ? contactIdLine.split(`:`)[1].replace(/\+/g, ``).replace(/ /g, ``)
      : null;

    if (!contactId) {
      message.reply(
        `${robotEmoji} No se pudo obtener el ID del contacto desde el mensaje citado.`
      );
      return;
    }

    contactIds.push(`${contactId}@c.us`);
  }

  if (
    !admins.some(
      (admin) => admin.id._serialized === `${client.info.wid.user}@c.us`
    )
  ) {
    return message.reply(
      `${robotEmoji} Necesito permisos de administrador en el grupo para continuar.`
    );
  }

  try {
    await groupChat.addParticipants(contactIds);
    message.reply(`${robotEmoji} Los usuarios han sido agregados al grupo.`);
  } catch (error) {
    message.reply(
      `${robotEmoji} No se pudo agregar a los usuarios al grupo. Por favor, verifica que los contactos sean válidos y que no estén ya en el grupo.`
    );
  }
}

async function processUser(
  userIds,
  adminCondition,
  action,
  successMessage,
  failMessage,
  chat,
  message,
  robotEmoji
) {
  const userArray = Array.isArray(userIds) ? userIds : [userIds];
  const usersToProcess = userArray.filter((userId) => adminCondition(userId));

  if (usersToProcess.length > 0) {
    await chat[action](usersToProcess);
    message.reply(`${robotEmoji} ${successMessage} ${usersToProcess.length}`);
  } else {
    message.reply(`${robotEmoji} ${failMessage}`);
  }
}

async function handleJoinGroupRequest(
  stringifyMessage,
  message,
  client,
  robotEmoji,
  prefix_admin,
  command
) {
  if (stringifyMessage.length !== 2) {
    message.reply(
      `${robotEmoji} El comando no es válido. Por favor, envía el enlace de invitación al grupo usando el formato correcto:\n\n${prefix_admin}${command} https://chat.whatsapp.com/TuCodigoDeInvitacion`
    );
    return;
  }

  const inviteLink = stringifyMessage[1];

  if (!inviteLink.startsWith(`https://chat.whatsapp.com/`)) {
    message.reply(
      `${robotEmoji} El enlace de invitación que mandaste no parece válido. Por favor, verifica el enlace e inténtalo de nuevo.`
    );
    return;
  }

  const inviteCode = inviteLink.split(`https://chat.whatsapp.com/`)[1];

  try {
    const joinedGroupId = await client.acceptInvite(inviteCode);
    message.reply(`${robotEmoji} ¡Listo! Me acabo de unir al grupo.`);
    const joinedGroup = await client.getChatById(joinedGroupId);
    joinedGroup.sendMessage(
      `¡Hey! Soy un bot 🤖 y me acabo de unir a este grupo. Para terminar de configurar todo, usa el comando ${prefix_admin}addgroup para activarme.`
    );
  } catch (error) {
    message.reply(
      `${robotEmoji} No me he podido unir al grupo. Asegúrate de que el enlace de invitación sea correcto y de que aún esté activo.`
    );
  }
}

async function handleDeleteMessage(
  admins,
  stringifyMessage,
  message,
  quotedMessage,
  client,
  robotEmoji
) {
  if (
    !admins.some(
      (admin) => admin.id._serialized === `${client.info.wid.user}@c.us`
    )
  ) {
    return message.reply(
      `${robotEmoji} Es necesario que el bot sea administrador del grupo.`
    );
  }

  if (quotedMessage && stringifyMessage.length === 1) {
    const quotedAuthor = quotedMessage.author;
    if (quotedAuthor === `${client.info.wid.user}:8@c.us`) {
      message.reply(`${robotEmoji} Cómo te atreves.`);
    }
    await quotedMessage.delete(true);
  } else {
    message.reply(
      `${robotEmoji} Para eliminar un mensaje, simplemente responde a él.`
    );
  }
}

async function handleToggleBotActivation(
  stringifyMessage,
  message,
  chat,
  robotEmoji,
  refreshDataCallback,
  senderPhoneNumber,
  groupId
) {
  if (stringifyMessage.length === 2) {
    const botCommand = stringifyMessage[1];

    switch (botCommand) {
      case `on`:
        await enableBot(message, chat.id._serialized, robotEmoji);
        await refreshDataCallback();
        break;
      case `off`:
        await disableBot(message, chat.id._serialized, robotEmoji);
        await refreshDataCallback();
        break;
      case `special`:
        try {
          const activationMessage = await specialDay.activateSpecialDay(
            senderPhoneNumber,
            groupId
          );
          message.reply(`${robotEmoji} ${activationMessage}`);
        } catch (error) {
          message.reply(`${robotEmoji} Houston, tenemos un problema.`);
          console.error(error);
        }
        break;
      default:
        message.reply(
          `${robotEmoji} Solo puedes habilitar o deshabilitar el bot.`
        );
        break;
    }
  } else {
    message.reply(`${robotEmoji} ¿Y qué quieres que haga?`);
  }
}

async function enableBot(message, groupId, robotEmoji) {
  try {
    const group = await supabaseCommunicationModule.searchPremiumGroup(groupId);
    if (group.isActive) {
      message.reply(`${robotEmoji} Este grupo ya tiene el bot activado.`);
    } else {
      await supabaseCommunicationModule.updateBotStatus(groupId, true);
      message.reply(`${robotEmoji} El bot se ha activado para este grupo.`);
    }
  } catch (error) {
    console.error(error);
  }
  return Promise.resolve();
}

async function disableBot(message, groupId, robotEmoji) {
  try {
    const group = await supabaseCommunicationModule.searchPremiumGroup(groupId);
    if (!group.isActive) {
      message.reply(
        `${robotEmoji} El bot ya está desactivado para este grupo.`
      );
    } else {
      await supabaseCommunicationModule.updateBotStatus(groupId, false);
      message.reply(`${robotEmoji} El bot se ha desactivado para este grupo.`);
    }
  } catch (error) {
    console.error(error);
  }
  return Promise.resolve();
}

async function hasValidSpecialDay(groupId) {
  const groupData = await supabaseCommunicationModule.searchSpecialDay(groupId);

  if (groupData && groupData.special_day_expiry) {
    const now = new Date();
    const specialDayExpiry = new Date(groupData.special_day_expiry);
    return now <= specialDayExpiry;
  }
  return false;
}

module.exports = {
  handleBanUserFromGroup,
  handlePromoteUsersToAdmins,
  handleDemoteUsersToParticipants,
  handleJoinGroupRequest,
  handleAddUserToGroup,
  handleDeleteMessage,
  handleToggleBotActivation,
  hasValidSpecialDay,
};
