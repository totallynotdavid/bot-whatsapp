const { URL } = require(`node:url`);
const utilities = require(`./utilities`);
const regex = require(`../functions/regex`);

let mediaSticker, originalQuotedMessage;
const allowedRedditHosts = [`www.reddit.com`, `reddit.com`];

async function processQuotedStickerMessage(
  stringifyMessage,
  message,
  chat,
  robotEmoji,
  senderName
) {
  if (
    stringifyMessage.length === 1 &&
    message._data.quotedMsg &&
    message._data.quotedMsg.type === `sticker`
  ) {
    originalQuotedMessage = await message.getQuotedMessage();
    mediaSticker = await originalQuotedMessage.downloadMedia();
    await chat.sendMessage(mediaSticker, {
      sendMediaAsSticker: false,
      caption: `${robotEmoji} Solicitado por ${senderName}.`,
    });
  } else {
    message.reply(
      `${robotEmoji} Contesta a un mensaje con un sticker. Solo usa el comando, no añadas nada más.`
    );
  }
}

async function transformMediaToSticker(
  chat,
  message,
  senderName,
  senderNumber,
  robotEmoji
) {
  if (!message.hasQuotedMsg && !message.hasMedia) {
    message.reply(`${robotEmoji} Tarao, te olvidaste de adjuntar la imagen.`);
    return;
  }

  try {
    if (message.hasQuotedMsg) {
      originalQuotedMessage = await message.getQuotedMessage();

      if (!originalQuotedMessage.hasMedia) {
        message.reply(`${robotEmoji} Este mensaje no contiene ninguna imagen.`);
        return;
      }

      mediaSticker = await originalQuotedMessage.downloadMedia();
    } else {
      mediaSticker = await message.downloadMedia();
    }
    await convertImageToSticker(
      chat,
      message,
      mediaSticker,
      senderName,
      senderNumber
    );
  } catch (error) {
    console.log(error);
  }
}

async function convertImageToSticker(
  chat,
  message,
  mediaSticker,
  senderName,
  senderNumber
) {
  try {
    senderName = senderName.trim();
    if (!utilities.containsVisibleChars(senderName) || senderName.length < 2) {
      var match = senderNumber.match(/(^|[^])\d+/);
      senderName = `+${match[0]}, necesitas un nombre para usar stickers`;
    }
    chat.sendMessage(mediaSticker, {
      sendMediaAsSticker: true,
      stickerName: `${senderName}`,
      stickerAuthor: `davibot`,
    });
    message.reply(`🤖 ¡Sticker en camino!`);
  } catch (e) {
    message.reply(
      `🤖 Hubo un error al tratar de convertir esta imagen en sticker.`
    );
  }
}

async function convertUrlImageToSticker(
  chat,
  message,
  sticker,
  senderName,
  senderNumber
) {
  convertImageToSticker(chat, message, sticker, senderName, senderNumber);
}

async function validateAndConvertMedia(
  chat,
  mediaURL,
  message,
  MessageMedia,
  senderName,
  senderNumber,
  robotEmoji,
  localFilePath = null
) {
  try {
    if (mediaURL.endsWith(`.gifv`)) {
      mediaURL = mediaURL.replace(/\.gifv$/i, `.mp4`);
    }

    const response = await fetch(mediaURL);
    const [contentType, contentLength] = (
      response.headers.get(`content-type`) || ``
    ).split(`;`);

    if (
      response.ok &&
      contentType &&
      (contentType.startsWith(`image/`) || contentType.startsWith(`video/`))
    ) {
      if (
        contentType.startsWith(`video/mp4`) &&
        contentLength &&
        parseInt(contentLength.split(`=`)[1]) > 20 * 1000
      ) {
        message.reply(
          `${robotEmoji} Necesitas ser un usuario de pago para enviar videos de más de 20 segundos.`
        );
      } else {
        let sticker;
        if (localFilePath) {
          sticker = await MessageMedia.fromFilePath(localFilePath);
        } else {
          sticker = await MessageMedia.fromUrl(mediaURL);
        }
        convertUrlImageToSticker(
          chat,
          message,
          sticker,
          senderName,
          senderNumber
        );
      }
    } else {
      message.reply(
        `${robotEmoji} Esa URL no es hacia el corazón de ella, ni siquiera es una imagen o video. Intenta de nuevo.`
      );
    }
  } catch (error) {
    console.error(error);
    message.reply(`${robotEmoji} Parece que algo salió mal, intenta de nuevo.`);
  }
}

/*
Test case for Reddit, Imgur and general URL checks with regex:
Youtube: https://www.reddit.com/r/neverchangejapan/comments/12spx82/ningen_isu_ringo_no_namida_a_metal_song_about_an/
Imagen: https://www.reddit.com/r/unixporn/comments/12ruaq1/xperia_10_iii_w_sailfish_w_arch_my_mobile_office/
Video: https://www.reddit.com/r/blackmagicfuckery/comments/12sex2d/pool_black_magic/
*/
async function handleStickerURL(
  stringifyMessage,
  message,
  robotEmoji,
  reddit,
  chat,
  MessageMedia,
  senderName,
  senderNumber
) {
  if (stringifyMessage.length !== 2) {
    message.reply(`${robotEmoji} URL, solo la URL.`);
    message.react(`⚠️`);
  } else {
    let stickerURL = stringifyMessage[1];

    if (
      !(
        regex.websiteAllowedRegex.test(stickerURL) ||
        regex.urlRegex.test(stickerURL) ||
        regex.imageOrVideoRegex.test(stickerURL)
      )
    ) {
      message.reply(
        `${robotEmoji} URL inválida, por favor verifica y vuelve a enviarlo. Solo se aceptan imágenes y videos.`
      );
      return;
    }

    stickerURL = stickerURL.replace(/\.gifv$/i, `.mp4`); // Fix for Imgur links

    try {
      const url = new URL(stickerURL);
      const isRedditUrl = allowedRedditHosts.includes(url.host);

      if (isRedditUrl) {
        const { mediaURL: redditMediaURL, media } =
          await reddit.handleRedditMedia(stickerURL, message, robotEmoji);
        if (!redditMediaURL) {
          return;
        }

        if (media.is_video) {
          const localFilePath = await reddit.saveRedditVideo(media);
          await validateAndConvertMedia(
            chat,
            redditMediaURL,
            message,
            MessageMedia,
            senderName,
            senderNumber,
            robotEmoji,
            localFilePath
          );
        } else {
          await validateAndConvertMedia(
            chat,
            redditMediaURL,
            message,
            MessageMedia,
            senderName,
            senderNumber,
            robotEmoji
          );
        }
      } else {
        await validateAndConvertMedia(
          chat,
          stickerURL,
          message,
          MessageMedia,
          senderName,
          senderNumber,
          robotEmoji
        );
      }
    } catch (error) {
      console.error(`Error parsing URL:`, error);
      message.reply(
        `${robotEmoji} URL inválida, por favor verifica y vuelve a enviarlo.`
      );
    }
  }
}

module.exports = {
  processQuotedStickerMessage,
  transformMediaToSticker,
  convertUrlImageToSticker,
  validateAndConvertMedia,
  handleStickerURL,
};
