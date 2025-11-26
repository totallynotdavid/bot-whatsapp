const fs = require(`fs`).promises;
const { downloadFilesFromGoogleDrive } = require(`../lib/api/gdrive`);

async function handleGoogleDriveDownloads(
  stringifyMessage,
  message,
  query,
  client,
  MessageMedia,
  robotEmoji
) {
  switch (stringifyMessage.length) {
    case 2:
      try {
        const filePath = await downloadFilesFromGoogleDrive(query);
        const maxSize = 200 * 1024 * 1024;
        const fileStats = await fs.stat(filePath);

        if (fileStats.size > maxSize) {
          await fs.unlink(filePath);
          return message.reply(
            `${robotEmoji} El archivo es demasiado grande. El tamaño máximo es de 200 MB.`
          );
        }

        const media = await MessageMedia.fromFilePath(filePath);
        await client.sendMessage(message.id.remote, media, {
          caption: `${robotEmoji} Aquí tienes tu archivo.`,
        });

        await fs.unlink(filePath);
      } catch (error) {
        console.error(`Error sending file:`, error);
        message.reply(`${robotEmoji} ¿Seguro de que ese archivo existe?`);
      }
      break;
    case 1:
      message.reply(`${robotEmoji} Ya, pero, ¿de qué quieres descargar?`);
      break;
    default:
      message.reply(`${robotEmoji} Envía solo un enlace de Google Drive.`);
  }
}

module.exports = {
  handleGoogleDriveDownloads,
};
