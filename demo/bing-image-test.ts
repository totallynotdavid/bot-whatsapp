// only for paid users

import { generateBingImages } from "../src/infrastructure/external/bing-image-generator";

const prompt = process.argv.slice(2).join(" ");

if (!prompt) {
  console.error("Usage: bun demo/bing-image-test.ts <prompt>");
  process.exit(1);
}

const authCookie = process.env.BING_IMAGE_COOKIE;
if (!authCookie) {
  console.error("Error: BING_IMAGE_COOKIE not found in environment");
  process.exit(1);
}

const outputDir = "./fixedData";
const debugMode = process.env.DEBUG === "true";

console.log(`Generating images for: "${prompt}"`);
if (debugMode) {
  console.log("[Debug mode enabled - intermediate responses will be saved]");
}

try {
  const savedPaths = await generateBingImages(
    prompt,
    authCookie,
    outputDir,
    debugMode
  );

  console.log(`\nSaved ${savedPaths.length} images:`);
  savedPaths.forEach((path) => console.log(`  ${path}`));
} catch (error) {
  console.error("\nFailed to generate images:", error);
  process.exit(1);
}
