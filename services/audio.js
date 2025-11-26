const fs = require("fs").promises;
const path = require("path");
const fetch = require("node-fetch");
const { MessageMedia } = require("whatsapp-web.js");
const { v4: uuidv4 } = require("uuid");

const AUDIO_DIR = path.join(__dirname, "..", "audio");

async function downloadAudio(url, filePath) {
  const response = await fetch(url);
  const buffer = await response.buffer();
  await fs.writeFile(filePath, buffer);
}

async function sendAudio(client, message, filePath) {
  try {
    const media = MessageMedia.fromFilePath(filePath);
    await client.sendMessage(message.from, media, {
      sendAudioAsVoice: true,
    });
  } catch (error) {
    console.error("Error sending audio:", error);
    throw error;
  }
}

async function saveAndSendAudioBuffer(client, message, audioBuffer) {
  const fileName = `${uuidv4()}.mp3`;
  const filePath = path.join(AUDIO_DIR, fileName);

  try {
    await fs.writeFile(filePath, audioBuffer);
    await sendAudio(client, message, filePath);
  } catch (error) {
    console.error("Error saving or sending audio buffer:", error);
    throw error;
  } finally {
    try {
      await fs.unlink(filePath);
    } catch (unlinkError) {
      console.error("Error deleting temporary audio file:", unlinkError);
    }
  }
}

module.exports = { downloadAudio, sendAudio, saveAndSendAudioBuffer };
