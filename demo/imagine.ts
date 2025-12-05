// bing-image-demo.ts
// Minimal example: generate images using Bing Image Creator
// Usage: bun bing-image-demo.ts "fox looking up"

import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { generateImageFiles } from "bimg";

const OUTPUT_DIR = "./fixedData";

async function generateAndSaveImages(prompt: string): Promise<string[]> {
  const imageFiles = await generateImageFiles(prompt);

  await mkdir(OUTPUT_DIR, { recursive: true });

  const timestamp = Date.now();
  const safePrompt = prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_");
  const savedPaths: string[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const data = Buffer.from(imageFiles[i]!.data, "base64");
    const filename = `${safePrompt}_${timestamp}_${i + 1}.jpg`;
    const filepath = join(OUTPUT_DIR, filename);

    await writeFile(filepath, data);
    savedPaths.push(filepath);
  }

  return savedPaths;
}

const prompt = process.argv.slice(2).join(" ");

if (!prompt) {
  console.error("Usage: bun bing-image-demo.ts <prompt>");
  process.exit(1);
}

console.log(`Generating images for: "${prompt}"`);

try {
  const savedPaths = await generateAndSaveImages(prompt);
  console.log(`Saved ${savedPaths.length} images:`);
  savedPaths.forEach((path) => console.log(`  ${path}`));
} catch (error) {
  console.error("Failed to generate images:", error);
  process.exit(1);
}
