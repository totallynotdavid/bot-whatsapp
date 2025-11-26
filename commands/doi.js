const { fetchArticle } = require("../services/scihub");
const { getPaperDetails } = require("../services/semantic-scholar");
const { downloadPdf } = require("../services/pdf");

async function handleDoiRequest(input) {
  const isDOI = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i.test(input);

  try {
    let paperDetails = null;
    let pdfPath = null;

    if (isDOI) {
      paperDetails = await getPaperDetails(input);
    }

    const sciHubResult = await fetchArticle(input);

    if (sciHubResult.pdfLink) {
      pdfPath = await downloadPdf(sciHubResult.pdfLink, input);
    }

    return {
      paperDetails,
      pdfPath,
      title: sciHubResult.title || (paperDetails ? paperDetails.title : null),
      success: !!pdfPath,
      message: pdfPath ? null : "No se pudo encontrar el PDF del artículo.",
    };
  } catch (error) {
    console.error("Error in handleDoiRequest:", error);
    return {
      success: false,
      message: `Se ha producido un error al intentar obtener el artículo: ${error.message}`,
    };
  }
}

module.exports = { handleDoiRequest };
