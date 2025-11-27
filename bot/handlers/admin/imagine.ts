const { saveImageFilesLocally } = require("../../services/bing-image-creator");
const { fetchImageAndWriteToFile } = require("../../services/stable-difussion");
const { SmartPromptImprover } = require("../../functions/promptImprover");
const translate = require("../translate.ts");

// 9 out of 10 calls are made to Bing Image API
let callCounter = 0;

async function handleImagineBing(prompt) {
  const pathsFromImagesBing = await saveImageFilesLocally(prompt);
  return pathsFromImagesBing;
}

async function handleImagineStability(prompt) {
  const pathsFromImagesSA = await fetchImageAndWriteToFile(prompt);
  return pathsFromImagesSA;
}

async function handleImagine(spanishPrompt) {
  const promptImprover = new SmartPromptImprover();
  const { options, cleanCommand } = promptImprover.parseCommand(spanishPrompt);

  // Translate the cleaned Spanish prompt to English
  const translatedPrompt = await translate.translateText(cleanCommand);
  // Improve the English prompt
  const improvedPrompt = promptImprover.improvePrompt(
    translatedPrompt,
    options
  );

  callCounter++;
  try {
    if (callCounter % 5 !== 0) {
      return await handleImagineBing(improvedPrompt);
    } else {
      return await handleImagineStability(improvedPrompt);
    }
  } catch (err) {
    console.error(`Error al generar la imagen: ${err}`);
    if (callCounter % 5 !== 0) {
      try {
        return await handleImagineStability(improvedPrompt);
      } catch (err) {
        console.error(`Error al usar Stability: ${err}`);
        throw err;
      }
    }
    throw err;
  }
}

async function execute(ctx) {
  const { parsed } = ctx;
  const { args } = parsed;

  if (args.length === 0) {
    return { text: '🤖 Por favor, proporciona un prompt para generar la imagen.' };
  }

  const prompt = args.join(' ');

  try {
    const imagePaths = await handleImagine(prompt);

    if (imagePaths && imagePaths.length > 0) {
      // Return the first image
      return {
        media: {
          path: imagePaths[0],
          caption: `🤖 Imagen generada para: ${prompt}`,
        },
      };
    } else {
      return { text: '🤖 No se pudo generar la imagen.' };
    }
  } catch (err) {
    console.error('Error in imagine:', err);
    return { text: '🤖 Error generando la imagen.' };
  }
}

module.exports = { execute };

