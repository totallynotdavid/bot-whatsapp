const { translate } = require("@vitalets/google-translate-api");

async function translateText(
  commandQuery,
  defaultTargetLang = "es",
  defaultSourceLang = "auto"
) {
  const langPattern = /^[a-z]{2}$/i;
  let sourceLang = defaultSourceLang;
  let targetLang = defaultTargetLang;
  let textToBeTranslated = commandQuery.trim();
  let textArray = [];

  try {
    const parts = commandQuery.split(" ");

    if (
      parts.length > 2 &&
      langPattern.test(parts[0]) &&
      langPattern.test(parts[1])
    ) {
      [sourceLang, targetLang, ...textArray] = parts;
      textToBeTranslated = textArray.join(" ");
    } else if (parts.length > 1 && langPattern.test(parts[0])) {
      [targetLang, ...textArray] = parts;
      textToBeTranslated = textArray.join(" ");
    }

    return await performTranslation(textToBeTranslated, targetLang, sourceLang);
  } catch (error) {
    console.warn(
      "Initial translation failed, treating input as full sentence:",
      error
    );
    return await performTranslation(
      commandQuery.trim(),
      defaultTargetLang,
      defaultSourceLang
    );
  }
}

async function performTranslation(text, targetLang, sourceLang) {
  try {
    const { text: translatedText } = await translate(text, {
      from: sourceLang,
      to: targetLang,
    });
    return translatedText;
  } catch (error) {
    console.error("Translation failed:", error);
    throw new Error("Ocurrió un error al traducir el texto.");
  }
}

module.exports = { translateText };
