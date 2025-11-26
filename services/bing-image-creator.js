const fs = require(`fs`).promises;
const path = require(`path`);

async function saveImageFilesLocally(prompt) {
  const { generateImageFiles } = await import(`bimg`);
  const imageFiles = await generateImageFiles(prompt);

  const paths = [];
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const data = Buffer.from(file.data, `base64`);
    const fileName = `image${i + 1}.jpg`;
    const fileDir = path.resolve(__dirname, `..`, `img`, fileName);

    await fs.writeFile(fileDir, data);
    paths.push(path.resolve(fileDir));
  }

  return paths;
}

module.exports = { saveImageFilesLocally };
