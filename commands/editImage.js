const DIG = require(`discord-image-generation`);
const fetch = require(`node-fetch`);
const fs = require(`fs`);
const path = require(`path`);
const ffmpeg = require(`fluent-ffmpeg`);

const { ImgurClient } = require(`imgur`);
const clientImgur = new ImgurClient({ clientId: process.env.IMGUR_CLIENT_ID });

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
    outputFormat: `gif`,
  },
  Triggered: {
    maxAvatars: 1,
    function: (avatars) => new DIG.Triggered().getImage(avatars[0]),
    outputFormat: `gif`,
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

const commandMap = new Map(
  Object.entries(commandDefinitions).map(([key, val]) => [
    key.toLowerCase(),
    { command: val, originalKey: key },
  ])
);

function isValidEditType(editType) {
  const editTypeLowerCase = editType.toLowerCase();
  const matchedCommand = commandMap.get(editTypeLowerCase);

  if (!matchedCommand) {
    return [
      false,
      editType,
      `¿Qué estás intentando? No sé qué quieres decir con ${editType}`,
    ];
  }

  return [true, matchedCommand.originalKey, matchedCommand];
}

async function getMentions(
  stringifyMessage,
  command,
  message,
  client,
  imgPaths,
  robotEmoji
) {
  let mentions;
  if (command.maxAvatars === Infinity) {
    mentions = stringifyMessage.slice(2, -1);
  } else {
    mentions = stringifyMessage.slice(2, 2 + command.maxAvatars);
  }

  let uniqueMentions = Array.from(new Set(mentions));

  let avatarsPromises = uniqueMentions.map((mention) => {
    if (!/^@\d{3,}$/.test(mention)) {
      message.reply(`${robotEmoji} Mención inválida: ${mention}`);
      return;
    }
    return getImgurLink(client, mention, imgPaths);
  });

  let uniqueAvatars = await Promise.all(avatarsPromises);
  let uniqueLinks = uniqueAvatars.map((avatar) => avatar[0]);
  let deleteHashes = uniqueAvatars.map((avatar) => avatar[1]);
  return [
    mentions.map((mention) => uniqueLinks[uniqueMentions.indexOf(mention)]),
    deleteHashes,
  ];
}

async function getParameters(stringifyMessage, command) {
  let parameters = [];

  if (command.needsNumber) {
    let number = parseFloat(stringifyMessage[stringifyMessage.length - 1]); // Get the number at the end of the array
    if (isNaN(number)) {
      throw new Error(
        `Invalid number value: ${stringifyMessage[stringifyMessage.length - 1]}`
      );
    }
    parameters.push(number);
  } else if (command.needsText) {
    parameters.push(stringifyMessage.slice(2 + command.maxAvatars).join(` `));
  } else if (command.needsCurrency) {
    parameters.push(stringifyMessage[2 + command.maxAvatars]);
  } else if (command.name === `Podium`) {
    let names = stringifyMessage.slice(2 + command.maxAvatars);
    parameters.push(names);
  }

  return parameters;
}

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

async function getMedia(imgURL, command, MessageMedia) {
  const fileExtension = command.outputFormat || `png`;
  let imgPath = path.resolve(
    __dirname,
    `..`,
    `img`,
    `edited_image_${Date.now()}.${fileExtension}`
  );

  fs.writeFileSync(imgPath, imgURL);

  let media = MessageMedia.fromFilePath(imgPath);
  if (fileExtension === `gif`) {
    let videoPath = imgPath.replace(`.gif`, `.mp4`);
    await new Promise((resolve, reject) => {
      ffmpeg(imgPath)
        .outputOptions(`-movflags`, `faststart`)
        .toFormat(`mp4`)
        .saveToFile(videoPath)
        .on(`end`, resolve)
        .on(`error`, reject);
    });

    imgPath = videoPath;
    media = MessageMedia.fromFilePath(imgPath);
  }

  return [media, imgPath];
}

async function handleEditImage(
  stringifyMessage,
  message,
  client,
  MessageMedia,
  robotEmoji
) {
  try {
    const [isValid, editType, matchedCommandOrError] = isValidEditType(
      stringifyMessage[1].substr(1)
    );
    if (!isValid) {
      return message.reply(`${robotEmoji} ${matchedCommandOrError}.`);
    }

    const command = commandDefinitions[editType];

    let imgPaths = []; // We will push the urls of the images (used by getImgurLink) to this array
    const [avatars, deleteHashes] = await getMentions(
      stringifyMessage,
      command,
      message,
      client,
      imgPaths,
      robotEmoji
    ); // Returns the imgur links of the avatars and the deleteHashes

    if (avatars.length > command.maxAvatars) {
      return message.reply(
        `${robotEmoji} ${editType} requiere exactamente ${command.maxAvatars} menciones.`
      );
    }

    const parameters = await getParameters(stringifyMessage, command); // Gets the "-" parameters
    const imgURL = await getImgURL(command, editType, parameters, avatars); // Calls DIG passing the parameters and the avatars and returns the images in Base64

    const [media, imgPath] = await getMedia(imgURL, command, MessageMedia); // Returns the MessageMedia object

    if (command.outputFormat === `gif`) {
      await handleSendMedia(client, message, media, robotEmoji, true);
    } else {
      await handleSendMedia(client, message, media, robotEmoji);
    }

    // Delete local files
    imgPaths.push(imgPath);
    deleteLocalFiles(imgPaths);

    // Delete images from imgur
    await deleteImgurImages(deleteHashes, clientImgur);
  } catch (err) {
    console.error(err);
    return message.reply(
      `${robotEmoji} Algo no salió bien. ¿Estás seguro de que usaste el comando correctamente?`
    );
  }
}

async function handleSendMedia(
  client,
  message,
  media,
  robotEmoji,
  sendVideoAsGif = false
) {
  let messageClientParameters = {
    caption: `${robotEmoji} Hey, aquí está ${
      sendVideoAsGif ? `el GIF` : `la imagen`
    }.`,
  };

  if (sendVideoAsGif) {
    messageClientParameters.sendVideoAsGif = true;
  }

  await client.sendMessage(message.id.remote, media, messageClientParameters);
  return `completed`;
}

async function getImgurLink(client, mention, imgPaths) {
  let chatId = mention.replace(`@`, ``) + `@c.us`;
  let imageUrl = await client.getProfilePicUrl(chatId);

  const response = await fetch(imageUrl);
  const buffer = await response.buffer();
  let imgPath = path.resolve(__dirname, `..`, `img`, `image_${Date.now()}.png`);
  fs.writeFileSync(imgPath, buffer);

  imgPaths.push(imgPath);

  let imgurUpload = await clientImgur.upload({
    image: fs.createReadStream(imgPath),
    type: `stream`,
  });

  return [imgurUpload.data.link, imgurUpload.data.deletehash];
}

// Cleaning up the files
function deleteLocalFiles(paths) {
  for (let path of paths) {
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
  }
}

async function deleteImgurImages(deleteHashes, client) {
  for (let deleteHash of deleteHashes) {
    await client.deleteImage(deleteHash);
  }
}

module.exports = { handleEditImage };
