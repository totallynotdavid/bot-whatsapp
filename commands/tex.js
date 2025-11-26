const { processLatex } = require("../services/pdflatex");

async function handleLatexToImage(query) {
  if (!query) {
    return { success: false, message: "Falta el código LaTeX." };
  }

  const beginRegex = /\\begin\{[a-z]*\}/g;
  if (beginRegex.test(query)) {
    return {
      success: false,
      message: "No uses \\begin{document} ni \\end{document}. No hacen falta.",
    };
  }

  try {
    const imagePath = await processLatex(query);
    return { success: true, imagePath };
  } catch (error) {
    console.error("Error in LaTeX processing:", error);
    return {
      success: false,
      message: "Hubo un error al procesar el código LaTeX.",
    };
  }
}

module.exports = { handleLatexToImage };
