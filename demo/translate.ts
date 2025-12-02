// Usage examples:
//   bun demo.ts "hello world"        -> auto-detects source, translates to Spanish (default)
//   bun demo.ts to-fr "hello world"  -> auto-detects source, translates to French

import { translate } from "@vitalets/google-translate-api";

type LanguageCode = string;

const DEFAULT_TARGET_LANGUAGE: LanguageCode = "es"; // Spanish
const DEFAULT_SOURCE_LANGUAGE: LanguageCode = "auto"; // let the API detect it

/**
 * Parse command-line arguments into:
 *   - target language (e.g. "es", "fr", "en")
 *   - text to translate
 *
 * Supported forms:
 *   bun demo.ts "some text"
 *   bun demo.ts to-es "some text"
 */
function parseCommandLineArguments(argv: string[]) {
  const [, , firstArg, ...restArgs] = argv;

  if (!firstArg) {
    throw new Error(
      [
        "Usage:",
        '  bun demo.ts "text to translate"',
        '  bun demo.ts to-<lang> "text to translate"',
        "",
        "Examples:",
        '  bun demo.ts "hello world"',
        '  bun demo.ts to-fr "hello world"',
      ].join("\n"),
    );
  }

  const isTargetSpecifier = firstArg.startsWith("to-");

  const rawTargetLanguage = isTargetSpecifier ? firstArg.slice(3) : undefined;
  const targetLanguage =
    rawTargetLanguage && rawTargetLanguage.length > 0
      ? rawTargetLanguage
      : DEFAULT_TARGET_LANGUAGE;

  const textParts = isTargetSpecifier ? restArgs : [firstArg, ...restArgs];
  const textToTranslate = textParts.join(" ").trim();

  if (!textToTranslate) {
    throw new Error("Nothing to translate. Provide some text in quotes.");
  }

  return { targetLanguage, textToTranslate };
}

/**
 * Perform the translation and print the result.
 * Exits with code 1 on error.
 */
async function main() {
  try {
    const { targetLanguage, textToTranslate } = parseCommandLineArguments(
      process.argv,
    );

    const result = await translate(textToTranslate, {
      from: DEFAULT_SOURCE_LANGUAGE,
      to: targetLanguage,
    });

    console.log(result.text);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error while translating.";
    console.error(message);
    process.exit(1);
  }
}

await main();
