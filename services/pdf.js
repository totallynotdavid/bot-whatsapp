const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const { pipeline } = require("stream");
const { promisify } = require("util");

const pipelineAsync = promisify(pipeline);

const PDF_DIR = path.join(__dirname, "../pdf");

if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

async function downloadPdf(pdfLink, identifier) {
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const sanitizedIdentifier = identifier.replace(/\//g, "_");
  const outputFilename = `${sanitizedIdentifier}_${timestamp}.pdf`;
  const outputPath = path.join(PDF_DIR, outputFilename);

  const response = await fetch(pdfLink);

  if (!response.ok) {
    throw new Error(
      `Failed to download PDF: ${response.status} ${response.statusText}`
    );
  }

  await pipelineAsync(response.body, fs.createWriteStream(outputPath));

  return outputPath;
}

module.exports = { downloadPdf };
