const fs = require("fs").promises;
const path = require("path");
const fetch = require("node-fetch");
const os = require("os");
const crypto = require("crypto");

const config = require("../config");
const { TEMP_DIR } = config;

async function fetchAndSaveFile(url, extension) {
  await fs.mkdir(TEMP_DIR, { recursive: true });
  const filePath = path.join(TEMP_DIR, `${Date.now()}_temp.${extension}`);
  const response = await fetch(url);
  const buffer = await response.buffer();
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function saveContentToFile(content, filePath) {
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

async function readFileAsBase64(filePath) {
  const buffer = await fs.readFile(filePath);
  return buffer.toString("base64");
}

async function cleanupTempFiles(filePaths) {
  await Promise.all(filePaths.map((filePath) => fs.unlink(filePath)));
}

async function createTempDirectory() {
  const tempDir = path.join(
    os.tmpdir(),
    crypto.randomBytes(16).toString("hex")
  );
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

async function cleanupDirectory(dir) {
  try {
    const files = await fs.readdir(dir);
    await Promise.all(files.map((file) => fs.unlink(path.join(dir, file))));
    await fs.rmdir(dir);
  } catch (error) {
    console.error(`Error cleaning up directory ${dir}:`, error);
  }
}

function getFileDirectory(filePath) {
  return path.dirname(filePath);
}

module.exports = {
  fetchAndSaveFile,
  saveContentToFile,
  readFileAsBase64,
  cleanupTempFiles,
  createTempDirectory,
  cleanupDirectory,
  getFileDirectory,
};
