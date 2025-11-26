const { Client, LocalAuth, MessageMedia } = require(`whatsapp-web.js`);
const qrcode = require(`qrcode-terminal`);
const supabaseCommunicationModule = require(
  `../lib/api/supabaseCommunicationModule.js`
);

// Import commands and utility functions
const {
  doi,
  author,
  paper,
  tex,
  lyrics,
  say,
  help,
  cae,
  wikipedia,
  reddit,
  utilities,
  stickers,
  docsearch,
  docdown,
  youtube,
  spotify,
  editImage,
  translate,
  chat,
  freeChat,
  resumen,
} = require(`../commands/index.js`);
const { handleContactRequest } = require(`../lib/handlers/contactHandler.js`);
const { launchPuppeteer } = require(`../lib/functions/index.js`);
const { cleanupDirectory, getFileDirectory } = require(
  `../utils/file-utils.js`
);
const { extractMessageData } = require(`../utils/extract-messages.js`);
const { processMentions } = require(`../utils/mentions.js`);

// Import admin commands
const {
  groups,
  db,
  mentions,
  imagine,
  getUserInfo,
  handleGlobalMessage,
} = require(`../commands/admin/index.js`);

// Import global variables
let {
  prefix,
  prefix_admin,
  ownerNumber,
  robotEmoji,
  paidUsers,
  physicsUsers,
  premiumGroups,
  commands,
  adminCommands,
} = require(`./globals`);

// Import specific commands
const { help: helpCommand, cae: caeCommand } = commands;

// Set function to update premium groups and users
const setFetchedData = (
  fetchedPaidUsers,
  fetchedPhysicsUsers,
  fetchedPremiumGroups
) => {
  paidUsers = fetchedPaidUsers;
  physicsUsers = fetchedPhysicsUsers;
  premiumGroups = fetchedPremiumGroups;
};

// Update data when called
let refreshDataCallback;
const setRefreshDataCallback = (callback) => {
  refreshDataCallback = callback;
};

/*
  WhatsApp components
*/
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: launchPuppeteer(),
});

client.on(`qr`, (qr) => {
  qrcode.generate(qr, {
    small: true,
  });
});

client.on(`auth_failure`, (authFailureMessage) => {
  console.error(`Error de autenticación`, authFailureMessage);
});

client.on(`ready`, () => {
  console.log(
    `Estamos listos, ¡el bot está en linea! Tenemos ${premiumGroups.length} grupos premium y ${paidUsers.length} usuarios premium. Los usuarios de física son ${physicsUsers.length}.`
  );
});

/*
  Event can be triggered by: message or message_create
  * message_create includes the messages by the bot itself (good for testing)
  * message is the one we want to use on production (it doesn't include the bot's messages)
*/
client.on(`message`, async (message) => {
  const isCommand =
    message.body.startsWith(prefix) || message.body.startsWith(prefix_admin);
  if (!isCommand) {
    return;
  }

  let contactInfo,
    chatInfo,
    senderPhoneNumber,
    isSenderPaidUser,
    senderName,
    groupId,
    commandParts,
    commandQuery;

  try {
    [contactInfo, chatInfo] = await Promise.all([
      message.getContact(),
      message.getChat(),
    ]);
    senderPhoneNumber = message.id.participant || message.id.remote;
    isSenderPaidUser = paidUsers.some(
      (user) => user.phone_number === senderPhoneNumber
    );

    if (!chatInfo.isGroup && !isSenderPaidUser) {
      await handleContactRequest(client, message, robotEmoji, ownerNumber);
      return;
    }

    senderName = contactInfo.pushname || message._data.notifyName; // The bot name is not defined, so we use the notifyName
    groupId = chatInfo.id._serialized;

    /* Creates an array with each word. Example: from "!spot dkdk" it will get "["!spot", "dkdk"]" */
    let stringifyMessage = message.body.trim().split(/\s+/);

    /* Get all the text after the command (yt & wiki & chat) */
    commandParts = message.body.trim().split(/\s+/);
    commandQuery = commandParts.slice(1).join(` `);

    /* Logging all commands received to Supabase */
    supabaseCommunicationModule.insertMessage(
      senderPhoneNumber,
      message.body,
      message.to,
      `users`
    );

    /*
          The checks are done in order of importance
          1. Check if the message is in a group
          Here there is a divergence between the admin and the regular commands
          1.a Regular: The message is in a premium group
          1.b Admin: The message is from a user who is a paid user
        */
    if (message.body.startsWith(prefix)) {
      if (
        !premiumGroups.some(
          (group) => group.group_id === groupId && group.isActive
        )
      )
        return;

      const command = stringifyMessage[0].split(prefix)[1];

      if (!(command in commands)) return;

      switch (command) {
        case commands.help: {
          const helpMessageText = help.getHelpMessage(
            prefix,
            stringifyMessage,
            helpCommand
          );
          message.reply(`${robotEmoji} ${helpMessageText}`);
          break;
        }
        case commands.sticker:
          stickers.transformMediaToSticker(
            chatInfo,
            message,
            senderName,
            senderPhoneNumber,
            robotEmoji
          );
          break;
        case commands.toimage:
          stickers.processQuotedStickerMessage(
            stringifyMessage,
            message,
            chatInfo,
            robotEmoji,
            senderName
          );
          break;
        case commands.url:
          stickers.handleStickerURL(
            stringifyMessage,
            message,
            robotEmoji,
            reddit,
            chatInfo,
            MessageMedia,
            senderName,
            senderPhoneNumber
          );
          break;
        case commands.spot:
          spotify(client, message, commandQuery);
          break;
        case commands.letra: {
          const songName = stringifyMessage.slice(1).join(" ");
          if (!songName) {
            message.reply(
              `${robotEmoji} Cómo te atreves a pedirme la letra de una canción sin decirme el nombre.`
            );
          } else {
            const result = await lyrics.handleSongLyricsRequest(songName);
            if (result.success) {
              const replyMessage = `${robotEmoji} *Título:* ${result.title}\n*Artista:* ${result.artist}\n\n*Letra:*\n${result.lyrics}`;
              message.reply(replyMessage);
            } else {
              message.reply(
                `${robotEmoji} ${
                  result.error === "Lyrics not found"
                    ? "Mmm... No encontré la letra de esta canción."
                    : "Hubo un error al buscar la letra de la canción."
                }`
              );
            }
          }
          break;
        }
        case commands.cae:
          cae.getCAEMessage(
            prefix,
            stringifyMessage,
            caeCommand,
            message,
            robotEmoji
          );
          break;
        case commands.reddit: {
          if (stringifyMessage.length === 1) {
            await message.reply(
              "Incluye el nombre del subreddit o el enlace a un post de Reddit."
            );
            return;
          }

          const result = await reddit.handleRedditCommand(stringifyMessage);
          if (!result.success) {
            await message.reply(`${robotEmoji} ${result.error}`);
            return;
          }

          if (result.data.media.urls.length > 0) {
            for (let i = 0; i < result.data.media.urls.length; i++) {
              const mediaUrl = result.data.media.urls[i];
              let media;

              if (mediaUrl.startsWith("data:video/mp4;base64,")) {
                media = new MessageMedia(
                  "video/mp4",
                  mediaUrl.split(",")[1],
                  "video.mp4"
                );
              } else {
                media = await MessageMedia.fromUrl(mediaUrl);
              }

              const options =
                i === 0
                  ? {
                      caption: `${robotEmoji} ${result.data.caption}`,
                    }
                  : {};

              if (media.mimetype === "video/mp4") {
                options.sendVideoAsGif = true;
              }

              await client.sendMessage(message.from, media, options);
            }
          } else {
            await client.sendMessage(
              message.from,
              `${robotEmoji} ${result.data.caption}`
            );
          }
          break;
        }
        case commands.w:
          wikipedia.handleWikipediaRequest(
            stringifyMessage,
            message,
            robotEmoji,
            commandQuery,
            senderName,
            client,
            MessageMedia
          );
          break;
        case commands.yt: {
          const searchResult = await youtube.searchOnYoutube(
            commandQuery,
            `fullData`
          );

          if (searchResult.error) {
            message.reply(searchResult.message);
          } else {
            if (searchResult.thumbnailUrl) {
              const media = await MessageMedia.fromUrl(
                searchResult.thumbnailUrl,
                { unsafeMime: true }
              );
              client.sendMessage(message.id.remote, media, {
                caption: searchResult.caption,
              });
            } else {
              message.reply(searchResult.caption);
            }
          }
          break;
        }
        case commands.play: {
          /*
                    const audioResponse =
                        await youtube.sendYoutubeAudio(commandQuery);
                    if (audioResponse.error) {
                        message.reply(`${robotEmoji} ${audioResponse.message}`);
                    } else {
                        const metadata = `${robotEmoji} El audio que encontré es: *${audioResponse.videoMetadata.title}* - *${audioResponse.videoMetadata.channelTitle}*`;
                        message.reply(metadata);

                        const media = MessageMedia.fromFilePath(
                            audioResponse.filePath
                        );

                        client.sendMessage(message.id.remote, media, {
                            sendAudioAsVoice: true,
                        });

                        utilities.deleteFile(audioResponse.filePath);
                    }
                    */
          message.reply("Esta función está deshabilitada temporalmente.");
          break;
        }
        case commands.watch: {
          const videoResponse = await youtube.sendYoutubeVideo(commandQuery);

          if (videoResponse.error) {
            message.reply(`${robotEmoji} ${videoResponse.message}`);
          } else {
            const isWithinLimit = await utilities.isFileSizeWithinLimit(
              videoResponse.filePath,
              16
            );

            if (!isWithinLimit) {
              message.reply(
                `${robotEmoji} El video supera el límite de 16 MB. Prueba con otro video.`
              );
            } else {
              const media = await MessageMedia.fromFilePath(
                videoResponse.filePath
              );

              await client.sendMessage(message.id.remote, media);

              utilities.deleteFile(videoResponse.filePath);
            }
          }
          break;
        }
        case commands.say:
          await say.handleTextToSpeechCommand(
            client,
            message,
            stringifyMessage
          );
          break;
        case commands.doi: {
          const result = await doi.handleDoiRequest(commandQuery);

          if (result.success) {
            let caption = result.title
              ? `📄 *Título*: ${result.title}\n\n`
              : "";

            if (result.paperDetails) {
              const { authors, year, abstract } = result.paperDetails;
              if (authors && authors.length > 0)
                caption += `*Autor(es)*: ${authors.join(", ")}\n`;
              if (year) caption += `*Año*: ${year}\n`;
              if (abstract) caption += `\n*Resumen*:\n${abstract}`;
            }

            const media = MessageMedia.fromFilePath(result.pdfPath);
            await client.sendMessage(message.from, media, {
              caption,
            });
            utilities.deleteFile(result.pdfPath);
          } else {
            await message.reply(result.message);
          }
          break;
        }
        case commands.tex: {
          const result = await tex.handleLatexToImage(commandQuery);

          if (result.success) {
            try {
              const media = MessageMedia.fromFilePath(result.imagePath);
              await client.sendMessage(message.from, media, {
                caption: `${robotEmoji} Solicitado por ${senderName}`,
              });
            } catch (error) {
              console.error("Error sending image:", error);
              await message.reply(
                `${robotEmoji} Ha ocurrido un error al enviar la imagen. Inténtalo de nuevo ahora o más tarde.`
              );
            } finally {
              const directory = getFileDirectory(result.imagePath);
              await cleanupDirectory(directory);
            }
          } else {
            await message.reply(`${robotEmoji} ${result.message}`);
          }
          break;
        }
        case commands.paper: {
          const paperResponse = await paper.handlePaperSearch(commandQuery);
          await message.reply(`${robotEmoji} ${paperResponse}`);
          break;
        }
        case commands.author: {
          const authorResponse = await author.handleAuthorSearch(commandQuery);
          await message.reply(`${robotEmoji} ${authorResponse}`);
          break;
        }
        case commands.doc:
          docsearch.searchDocuments(
            stringifyMessage,
            message,
            commandQuery,
            robotEmoji
          );
          break;
        case commands.drive:
          docdown.handleGoogleDriveDownloads(
            stringifyMessage,
            message,
            commandQuery,
            client,
            MessageMedia,
            robotEmoji
          );
          break;
        case commands.chat: {
          const response = await freeChat.handleFreeChatCommand(
            senderPhoneNumber,
            groupId,
            commandQuery,
            robotEmoji
          );
          message.reply(`${robotEmoji} ${response}`);
          break;
        }
        case commands.edit:
          editImage.handleEditImage(
            stringifyMessage,
            message,
            client,
            MessageMedia,
            robotEmoji
          );
          break;
        case commands.t:
          try {
            const translatedMessage =
              await translate.translateText(commandQuery);
            message.reply(`${robotEmoji} ${translatedMessage}`);
          } catch (error) {
            message.reply(
              `${robotEmoji} Sorry, I couldn't translate that message.`
            );
          }
          break;
        default:
          break;
      }

      message.react(`✅`);
    }

    /*
            The logic here is the following:
            1. Check if string[1] is an actual command, this must be done because the user could send a message starting with the prefix but not being a command
            2. Check if the user is a paid user
        */
    if (message.body.startsWith(prefix_admin)) {
      const command = stringifyMessage[0].split(prefix_admin)[1];
      if (!(command in adminCommands)) return;

      if (!paidUsers.some((user) => user.phone_number === senderPhoneNumber)) {
        return message.reply(
          `${robotEmoji} Esta función está únicamente disponible para usuarios de pago.`
        );
      }

      /* Check if the sender is an admin of the group */
      const admins = chatInfo.participants.filter(
        (participant) => participant.isAdmin
      );

      const quotedMessage = await message.getQuotedMessage();

      switch (command) {
        case adminCommands.help: {
          const adminHelpMessageText = help.getAdminHelpMessage(
            prefix_admin,
            stringifyMessage,
            helpCommand
          );
          message.reply(`${robotEmoji} ${adminHelpMessageText}`);
          break;
        }
        case adminCommands.todos:
          mentions.mentionEveryone(chatInfo, client, message, senderName);
          break;
        case adminCommands.ban: {
          const banAll =
            stringifyMessage.length === 2 &&
            stringifyMessage[1] === `${prefix_admin}todos`;
          groups.handleBanUserFromGroup(
            admins,
            stringifyMessage,
            client,
            chatInfo,
            quotedMessage,
            message,
            robotEmoji,
            banAll
          );
          break;
        }
        case adminCommands.bot:
          groups.handleToggleBotActivation(
            stringifyMessage,
            message,
            chatInfo,
            robotEmoji,
            refreshDataCallback,
            senderPhoneNumber,
            groupId
          );
          break;
        case adminCommands.del:
          groups.handleDeleteMessage(
            admins,
            stringifyMessage,
            message,
            quotedMessage,
            client,
            robotEmoji
          );
          break;
        case adminCommands.join:
          groups.handleJoinGroupRequest(
            stringifyMessage,
            message,
            client,
            robotEmoji,
            prefix_admin,
            adminCommands.join
          );
          break;
        case adminCommands.addgroup:
          db.handleUpgradeGroupToPremium(
            stringifyMessage,
            chatInfo,
            message,
            refreshDataCallback,
            robotEmoji,
            senderPhoneNumber,
            prefix,
            prefix_admin
          );
          break;
        case adminCommands.add:
          groups.handleAddUserToGroup(admins, message, client, robotEmoji);
          break;
        case adminCommands.addpremium:
          db.handleUpgradeUserToPremium(
            senderPhoneNumber,
            ownerNumber,
            quotedMessage,
            stringifyMessage,
            message,
            robotEmoji,
            prefix_admin
          );
          break;
        case adminCommands.refresh:
          db.handleRefreshLocalDataFromDatabase(
            senderPhoneNumber,
            ownerNumber,
            stringifyMessage,
            message,
            robotEmoji,
            refreshDataCallback
          );
          break;
        case adminCommands.promote:
          groups.handlePromoteUsersToAdmins(
            admins,
            message,
            stringifyMessage,
            quotedMessage,
            chatInfo,
            client,
            robotEmoji
          );
          break;
        case adminCommands.demote:
          groups.handleDemoteUsersToParticipants(
            admins,
            message,
            stringifyMessage,
            quotedMessage,
            chatInfo,
            client,
            robotEmoji
          );
          break;
        case adminCommands.close: {
          const closeResponse = await chatInfo.setMessagesAdminsOnly(true);
          if (closeResponse) {
            message.reply(
              `${robotEmoji} Mensajes permitidos solo para administradores.`
            );
          } else {
            message.reply(
              `${robotEmoji} Error al cambiar la configuración. Asegúrate de tener los permisos necesarios.`
            );
          }
          break;
        }
        case adminCommands.open: {
          const openResponse = await chatInfo.setMessagesAdminsOnly(false);
          if (openResponse) {
            message.reply(
              `${robotEmoji} Mensajes permitidos para todos los miembros.`
            );
          } else {
            message.reply(
              `${robotEmoji} Error al cambiar la configuración. Asegúrate de tener los permisos necesarios.`
            );
          }
          break;
        }
        case adminCommands.chat: {
          const response = await chat.handleChatCommand(
            message.from,
            message.id.remote,
            commandQuery
          );
          await message.reply(`🤖 ${response}`);
          break;
        }
        case adminCommands.resumen: {
          try {
            const allMessages = await chatInfo.fetchMessages({
              limit: Infinity,
            });

            const extractedMessages = extractMessageData(allMessages, {
              limit: 60,
              textOnly: false,
            });

            const summary = await resumen.summarizeMessages(extractedMessages);

            const { processedSummary, mentions } = await processMentions(
              summary,
              chatInfo,
              client
            );

            await chatInfo.sendMessage(
              `${robotEmoji} ${processedSummary}\n\n_Esta función está en desarrollo, así que puede generar resultados inesperados._`,
              {
                mentions: mentions,
              }
            );
          } catch (error) {
            console.error("Error in resumen command:", error);
            await message.reply("Ocurrió un error. Inténtalo de nuevo.");
          }
          break;
        }
        case adminCommands.imagine:
          if (commandQuery.length > 4) {
            message.reply(
              `${robotEmoji} Trabajando en ello... dame unos segundos.`
            );

            try {
              const pathsToImages = await imagine.handleImagine(commandQuery);

              if (pathsToImages.length === 0) {
                return message.reply(
                  `${robotEmoji} No logré generar una imagen. Contacta al desarrollador.`
                );
              }

              pathsToImages.forEach((pathToImage) => {
                const media = MessageMedia.fromFilePath(pathToImage);
                client.sendMessage(message.id.remote, media);
              });

              message.reply(
                `${robotEmoji} ¡Terminamos, ya vienen las imágenes!`
              );
            } catch (error) {
              console.error("Error in imagine command:", error);
              message.reply(
                `${robotEmoji} Hubo un error al generar la imagen. Por favor intenta de nuevo.`
              );
            }
          } else {
            message.reply(
              `${robotEmoji} ¿Qué quieres ver? Escribe una descripción de la imagen que quieres ver.`
            );
          }
          break;
        case adminCommands.subscription: {
          const subscriptionInfo = await getUserInfo(
            client,
            senderPhoneNumber,
            robotEmoji,
            paidUsers,
            premiumGroups
          );
          await client.sendMessage(senderPhoneNumber, subscriptionInfo);
          await message.reply(
            `${robotEmoji} Hey, te acabo de enviar un mensaje privado con más información sobre tu suscripción.`
          );
          break;
        }
        case adminCommands.global:
          await handleGlobalMessage(
            client,
            paidUsers,
            senderPhoneNumber,
            ownerNumber,
            message,
            robotEmoji,
            stringifyMessage
          );
          break;
        default:
          break;
      }

      message.react(`✅`);
    }
  } catch (error) {
    console.error(`Error procesando mensaje:`, error);
  }
});

module.exports = {
  client,
  setFetchedData,
  setRefreshDataCallback,
};
