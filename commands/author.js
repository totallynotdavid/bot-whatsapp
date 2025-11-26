const { searchAuthorRecentPapers } = require("../services/semantic-scholar");

function formatPaperList(papers) {
  return papers
    .map((paper, index) => {
      let paperInfo = `${index + 1}. *${paper.title}* (${paper.year})`;
      if (paper.doi) {
        paperInfo += ` (DOI: https://doi.org/${paper.doi})`;
      }
      return paperInfo;
    })
    .join("\n\n");
}

async function handleAuthorSearch(query) {
  if (!query) {
    return "¿De qué autor quieres buscar?";
  }

  const result = await searchAuthorRecentPapers(query);
  if (result.success) {
    const paperList = formatPaperList(result.papers);
    return `Últimos artículos de ${query}:\n\n${paperList}`;
  } else {
    return result.message;
  }
}

module.exports = {
  handleAuthorSearch,
};
