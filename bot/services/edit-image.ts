/**
 * Edit Image Service using Discord Image Generation
 */

let DIG: any = null;

// Lazy load DIG
async function loadDIG() {
  if (DIG === null) {
    try {
      const module = await import('discord-image-generation');
      DIG = module.default;
    } catch (error) {
      console.warn('Discord Image Generation not available:', error.message);
      DIG = false; // Mark as unavailable
    }
  }
  return DIG;
}

import fetch from 'node-fetch';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { ImgurClient } from 'imgur';

const clientImgur = new ImgurClient({ clientId: process.env.IMGUR_CLIENT_ID });

/**
 * Command definitions for image editing
 */
const commandDefinitions = {
  Gay: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Gay().getImage(avatars[0]),
  },
  Greyscale: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Greyscale().getImage(avatars[0]),
  },
  Invert: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Invert().getImage(avatars[0]),
  },
  Blink: {
    maxAvatars: Infinity,
    needsNumber: true,
    function: (avatars, delay) => new DIG.Blink().getImage(delay, ...avatars),
    outputFormat: 'gif',
  },
  Triggered: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Triggered().getImage(avatars[0]),
    outputFormat: 'gif',
  },
  Ad: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Ad().getImage(avatars[0]),
  },
  Batslap: {
    maxAvatars: 2,
    function: (avatars) => new DIG.Batslap().getImage(avatars[0], avatars[1]),
  },
  Beautiful: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Beautiful().getImage(avatars[0]),
  },
  Bed: {
    maxAvatars: 2,
    function: (avatars) => new DIG.Bed().getImage(avatars[0], avatars[1]),
  },
  Bobross: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Bobross().getImage(avatars[0]),
  },
  Clown: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Clown().getImage(avatars[0]),
  },
  ConfusedStonk: {
    maxAvatars: 1,
    function: (avatars) => new DIG.ConfusedStonk().getImage(avatars[0]),
  },
  Deepfry: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Deepfry().getImage(avatars[0]),
  },
  Delete: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Delete().getImage(avatars[0]),
  },
  DoubleStonk: {
    maxAvatars: 2,
    function: (avatars) =>
      new DIG.DoubleStonk().getImage(avatars[0], avatars[1]),
  },
  Facepalm: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Facepalm().getImage(avatars[0]),
  },
  Hitler: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Hitler().getImage(avatars[0]),
  },
  Jail: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Jail().getImage(avatars[0]),
  },
  Kiss: {
    maxAvatars: 2,
    function: (avatars) => new DIG.Kiss().getImage(avatars[0], avatars[1]),
  },
  LisaPresentation: {
    maxAvatars: 0,
    needsText: true,
    function: (text) => new DIG.LisaPresentation().getImage(text),
  },
  Mikkelsen: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Mikkelsen().getImage(avatars[0]),
  },
  NotStonk: {
    maxAvatars: 1,
    function: (avatars) => new DIG.NotStonk().getImage(avatars[0]),
  },
  Podium: {
    maxAvatars: 3,
    function: (avatars, names) =>
      new DIG.Podium().getImage(avatars[0], avatars[1], avatars[2], ...names),
  },
  Poutine: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Poutine().getImage(avatars[0]),
  },
  Rip: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Rip().getImage(avatars[0]),
  },
  Snyder: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Snyder().getImage(avatars[0]),
  },
  Stonk: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Stonk().getImage(avatars[0]),
  },
  Trash: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Trash().getImage(avatars[0]),
  },
  Wanted: {
    maxAvatars: 1,
    needsCurrency: true,
    function: (avatars, currency) =>
      new DIG.Wanted().getImage(avatars[0], currency),
  },
};

/**
 * Check if edit type is valid
 * @param {string} editType - Edit type to check
 * @returns {Array} [isValid, normalizedType, command]
 */
function isValidEditType(editType) {
  const editTypeLowerCase = editType.toLowerCase();
  const matchedCommand = Object.keys(commandDefinitions).find(
    (key) => key.toLowerCase() === editTypeLowerCase
  );

  if (!matchedCommand) {
    return [
      false,
      editType,
      `¿Qué estás intentando? No sé qué quieres decir con ${editType}`,
    ];
  }

  return [true, matchedCommand, commandDefinitions[matchedCommand]];
}

/**
 * Get image URLs from mentions
 * @param {Array} args - Command arguments
 * @param {Object} command - Command definition
 * @param {Object} client - WhatsApp client
 * @returns {Promise<Array>} [avatars, deleteHashes]
 */
async function getMentions(args, command, client) {
  let mentions;
  if (command.maxAvatars === Infinity) {
    mentions = args.slice(1, -1);
  } else {
    mentions = args.slice(1, 1 + command.maxAvatars);
  }

  let uniqueMentions = Array.from(new Set(mentions));

  let avatarsPromises = uniqueMentions.map((mention) => {
    if (!/^@\d{3,}$/.test(mention)) {
      throw new Error(`Mención inválida: ${mention}`);
    }
    return getImgurLink(client, mention);
  });

  let uniqueAvatars = await Promise.all(avatarsPromises);
  let uniqueLinks = uniqueAvatars.map((avatar) => avatar[0]);
  let deleteHashes = uniqueAvatars.map((avatar) => avatar[1]);
  return [
    mentions.map((mention) => uniqueLinks[uniqueMentions.indexOf(mention)]),
    deleteHashes,
  ];
}

/**
 * Get parameters from arguments
 * @param {Array} args - Command arguments
 * @param {Object} command - Command definition
 * @returns {Array} Parameters
 */
function getParameters(args, command) {
  let parameters = [];

  if (command.needsNumber) {
    let number = parseFloat(args[args.length - 1]);
    if (isNaN(number)) {
      throw new Error(
        `Invalid number value: ${args[args.length - 1]}`
      );
    }
    parameters.push(number);
  } else if (command.needsText) {
    parameters.push(args.slice(1 + command.maxAvatars).join(' '));
  } else if (command.needsCurrency) {
    parameters.push(args[1 + command.maxAvatars]);
  } else if (command.name === 'Podium') {
    let names = args.slice(1 + command.maxAvatars);
    parameters.push(names);
  }

  return parameters;
}

/**
 * Get edited image
 * @param {Object} command - Command definition
 * @param {string} editType - Edit type
 * @param {Array} parameters - Parameters
 * @param {Array} avatars - Avatar URLs
 * @returns {Promise<Buffer>} Image buffer
 */
async function getImgURL(command, editType, parameters, avatars) {
  let imgURL;
  if (editType in commandDefinitions) {
    switch (true) {
      case command.needsNumber:
      case command.needsCurrency:
        imgURL = await command.function(avatars, ...parameters);
        break;
      default:
        imgURL = await command.function(...parameters, avatars);
        break;
    }
  } else {
    throw new Error(`${editType} no es un comando válido.`);
  }
  return imgURL;
}

/**
 * Process media and return file path
 * @param {Buffer} imgURL - Image buffer
 * @param {Object} command - Command definition
 * @returns {Promise<string>} File path
 */
async function processMedia(imgURL, command) {
  const fileExtension = command.outputFormat || 'png';
  const imgDir = path.join(process.cwd(), 'img');
  await fsPromises.mkdir(imgDir, { recursive: true });

  let imgPath = path.join(imgDir, `edited_image_${Date.now()}.${fileExtension}`);

  fs.writeFileSync(imgPath, imgURL);

  if (fileExtension === 'gif') {
    const videoPath = imgPath.replace('.gif', '.mp4');
    await new Promise((resolve, reject) => {
      ffmpeg(imgPath)
        .outputOptions('-movflags', 'faststart')
        .toFormat('mp4')
        .saveToFile(videoPath)
        .on('end', resolve)
        .on('error', reject);
    });

    imgPath = videoPath;
  }

  return imgPath;
}

/**
 * Get Imgur link for profile picture
 * @param {Object} client - WhatsApp client
 * @param {string} mention - User mention
 * @returns {Promise<Array>} [link, deletehash]
 */
async function getImgurLink(client, mention) {
  let chatId = mention.replace('@', '') + '@c.us';
  let imageUrl = await client.getProfilePicUrl(chatId);

  const response = await fetch(imageUrl);
  const buffer = await response.buffer();
  const imgDir = path.join(process.cwd(), 'img');
  await fsPromises.mkdir(imgDir, { recursive: true });
  let imgPath = path.join(imgDir, `image_${Date.now()}.png`);
  fs.writeFileSync(imgPath, buffer);

  let imgurUpload = await clientImgur.upload({
    image: fs.createReadStream(imgPath),
    type: 'stream',
  });

  // Clean up local file
  await fsPromises.unlink(imgPath);

  return [imgurUpload.data.link, imgurUpload.data.deletehash];
}

/**
 * Delete images from Imgur
 * @param {Array} deleteHashes - Delete hashes
 */
async function deleteImgurImages(deleteHashes) {
  for (let deleteHash of deleteHashes) {
    try {
      await clientImgur.deleteImage(deleteHash);
    } catch (error) {
      console.error('Error deleting from Imgur:', error);
    }
  }
}

/**
 * Edit image
 * @param {Array} args - Command arguments
 * @param {Object} client - WhatsApp client
 * @returns {Promise<{filePath: string, isGif: boolean, deleteHashes: Array}>} Result
 */
async function editImage(args, client) {
  const DIG = await loadDIG();
  if (!DIG) {
    throw new Error('Image editing service is not available');
  }

  const [isValid, editType, command] = isValidEditType(args[0]);
  if (!isValid) {
    throw new Error(editType);
  }

  const [avatars, deleteHashes] = await getMentions(args, command, client);

  if (avatars.length > command.maxAvatars) {
    throw new Error(`${editType} requiere exactamente ${command.maxAvatars} menciones.`);
  }

  const parameters = getParameters(args, command);
  const imgURL = await getImgURL(command, editType, parameters, avatars);
  const filePath = await processMedia(imgURL, command);

  return {
    filePath,
    isGif: command.outputFormat === 'gif',
    deleteHashes,
  };
}

export { editImage, deleteImgurImages };

