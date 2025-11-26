const spotifyService = require("../services/spotify");
const messageService = require("../services/message");
const audioService = require("../services/audio");

module.exports = async function handleSpotifyCommand(client, message, query) {
  if (!query) {
    await messageService.sendMessage(
      client,
      message,
      "Oe, incluye la canción que quieres buscar."
    );
    return;
  }

  try {
    const song = await spotifyService.searchAndDownloadSong(query);
    if (song) {
      await messageService.sendMessage(
        client,
        message,
        `*${song.name}* de *${song.artist}*`
      );
      await audioService.sendAudio(client, message, song.filePath);
    } else {
      await messageService.sendMessage(
        client,
        message,
        "Lo siento, no pude encontrar la canción que buscas."
      );
    }
  } catch (error) {
    console.error("Error in Spotify command:", error);
    await messageService.sendMessage(
      client,
      message,
      "Tmr, algo salió mal. Intenta de nuevo o más tarde."
    );
  }
};
