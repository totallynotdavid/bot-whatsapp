import { generateBingImages } from "../src/infrastructure/external/bing-image-generator";

const prompt = process.argv.slice(2).join(" ");
if (!prompt) {
  console.error("Usage: bun demo/bing-image-test.ts <prompt>");
  process.exit(1);
}

const authCookie = process.env["BING_IMAGE_COOKIE"];
if (!authCookie) {
  console.error("Error: BING_IMAGE_COOKIE not found in environment");
  process.exit(1);
}

try {
  const savedPaths = await generateBingImages(prompt, authCookie, "./fixedData");
  console.log(`Saved ${savedPaths.length} images:`, savedPaths);
} catch (error) {
  console.error("Failed:", error);
  process.exit(1);
}
