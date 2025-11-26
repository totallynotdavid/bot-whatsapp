const { saveImageFilesLocally } = require("../../services/bing-image-creator");
const { fetchImageAndWriteToFile } = require("../../services/stable-difussion");
const { SmartPromptImprover } = require("../../functions/promptImprover");
const translate = require("../translate.js");

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

module.exports = { handleImagine, SmartPromptImprover };
