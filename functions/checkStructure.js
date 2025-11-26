const fs = require(`fs`);
const { readdirSync, rmSync } = require(`fs`);

// IMPORTANT: Use ./audio instead of ../audio because the index.js file is in the root folder
// Don't see this as relative to this file, but to the index.js file
const audioDirectory = `./audio`;
const videoDirectory = `./video`;
const pdfDirectory = `./pdf`;
const imgDirectory = `./img`;

function checkAndCreateFolder(directory, purpose) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory);
    console.log(
      `Created [${directory}] folder because there was none. This is to store the ${purpose} files.`
    );
  }
}

function cleanFolder(directory, purpose) {
  try {
    readdirSync(directory).forEach((f) => rmSync(`${directory}/${f}`));
  } catch (error) {
    console.error(`Error cleaning ${purpose} folder:`, error);
  }
}

function checkFolderStructure() {
  checkAndCreateFolder(audioDirectory, `audio`);
  checkAndCreateFolder(videoDirectory, `video`);
  checkAndCreateFolder(pdfDirectory, `PDF`);
  checkAndCreateFolder(imgDirectory, `images`);
}

function cleanFolderStructure() {
  cleanFolder(audioDirectory, `audio`);
  cleanFolder(videoDirectory, `video`);
  cleanFolder(pdfDirectory, `PDF`);
  cleanFolder(imgDirectory, `images`);
}

module.exports = {
  checkFolderStructure,
  cleanFolderStructure,
};
