const { searchPapersByKeywords } = require("../services/semantic-scholar");

function formatPaperList(papers) {
  return papers
    .map((paper, index) => {
      let paperInfo = `${index + 1}. *${paper.title}* (${
        paper.year
      }) de _${paper.authors}_`;
      if (paper.journal) {
        paperInfo += ` publicado en ${paper.journal}`;
      }
      if (paper.doi) {
        paperInfo += ` (DOI: https://doi.org/${paper.doi})`;
      }
      return paperInfo;
    })
    .join("\n\n");
}

async function handlePaperSearch(query) {
  if (!query) {
    return "¿De qué tema quieres buscar?";
  }

  const result = await searchPapersByKeywords(query);
  if (result.success) {
    const paperList = formatPaperList(result.papers);
    return `Resultados:\n\n${paperList}`;
  } else {
    return result.message;
  }
}

module.exports = {
  handlePaperSearch,
};
