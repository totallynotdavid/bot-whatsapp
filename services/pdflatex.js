const { execFile } = require("child_process");
const util = require("util");
const os = require("os");
const {
  createTempDirectory,
  saveContentToFile,
  cleanupDirectory,
} = require("../utils/file-utils");

const execFilePromise = util.promisify(execFile);

const latexTemplate = `
\\documentclass[preview,border=2pt,convert={density=300,outext=.png}]{standalone}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{physics}
\\usepackage{bm}
\\begin{document}
\\begin{align*}
%s
\\end{align*}
\\end{document}
`;

async function processLatex(latexCode) {
  const tempDir = await createTempDirectory();
  const inputPath = `${tempDir}/input.tex`;
  const pdfPath = `${tempDir}/output.pdf`;
  const pngPath = `${tempDir}/output.png`;

  try {
    const latexDocument = latexTemplate.replace("%s", latexCode);
    await saveContentToFile(latexDocument, inputPath);

    await execFilePromise("pdflatex", [
      `-output-directory=${tempDir}`,
      "-jobname=output",
      inputPath,
    ]);

    const convertCommand = os.platform() === "win32" ? "magick" : "convert";
    const args = [
      "-density",
      "300",
      "-trim",
      "-background",
      "white",
      "-gravity",
      "center",
      "-extent",
      "120%x180%",
      "-alpha",
      "remove",
      pdfPath,
      "-quality",
      "100",
      "-define",
      "png:color-type=2",
      pngPath,
    ];

    if (os.platform() === "win32") {
      await execFilePromise("magick", ["convert", ...args]);
    } else {
      await execFilePromise(convertCommand, args);
    }

    return pngPath;
  } catch (error) {
    await cleanupDirectory(tempDir);
    throw error;
  }
}

module.exports = { processLatex };
