const fetch = require("node-fetch");

const BASE_DOMAIN = "https://api.semanticscholar.org";

async function fetchFromApi(endpoint, queryParams) {
  const queryString = new URLSearchParams(queryParams).toString();
  const url = `${BASE_DOMAIN}${endpoint}?${queryString}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json();
}

async function getDoi(paperId) {
  try {
    const response = await fetchFromApi(`/graph/v1/paper/${paperId}`, {
      fields: "externalIds",
    });
    return response.externalIds ? response.externalIds.DOI : null;
  } catch (error) {
    console.error(`Error getting DOI:`, error);
    return null;
  }
}

async function searchPapersByKeywords(keywords, maxResults = 5) {
  try {
    const response = await fetchFromApi("/graph/v1/paper/search", {
      query: encodeURIComponent(keywords.trim().replace(/\s\s+/g, " ")),
      fields: "paperId,title,authors,year,journal",
    });

    if (!response.data || response.data.length === 0) {
      return {
        success: false,
        message: "No se han encontrado artículos.",
      };
    }

    const formattedPapers = await Promise.all(
      response.data.slice(0, maxResults).map(async (paper) => {
        const authors = paper.authors.slice(0, 2).map((author) => author.name);
        const authorString =
          authors.length === paper.authors.length
            ? authors.join(", ")
            : `${authors.join(", ")} et al.`;
        const doi = await getDoi(paper.paperId);

        return {
          title: paper.title,
          year: paper.year,
          authors: authorString,
          journal: paper.journal?.name,
          doi: doi,
        };
      })
    );

    return { success: true, papers: formattedPapers };
  } catch (error) {
    console.error(`Error searching papers by keywords:`, error);
    return { success: false, message: "Error al buscar artículos." };
  }
}

async function getPaperDetails(doi, fields = "title,authors,year,abstract") {
  const paperId = `DOI:${doi}`;
  const endpoint = `/graph/v1/paper/${paperId}`;
  try {
    const response = await fetchFromApi(endpoint, { fields });
    return {
      ...response,
      authors: response.authors ? response.authors.map(({ name }) => name) : [],
    };
  } catch (error) {
    console.error("Error fetching paper details:", error);
    return null;
  }
}

async function searchAuthorRecentPapers(authorQuery, maxResults = 5) {
  try {
    const response = await fetchFromApi("/graph/v1/author/search", {
      query: encodeURIComponent(authorQuery),
      fields:
        "papers,papers.paperId,papers.externalIds,papers.title,papers.year",
    });

    if (!response.data || response.data.length === 0) {
      return {
        success: false,
        message: `No se encontraron artículos recientes para ${authorQuery}.`,
      };
    }

    const author = response.data[0];
    const recentPapers = author.papers
      .sort((a, b) => b.year - a.year)
      .slice(0, maxResults)
      .map((paper) => ({
        title: paper.title,
        year: paper.year,
        doi: paper.externalIds?.DOI || null,
      }));

    return { success: true, papers: recentPapers };
  } catch (error) {
    console.error(`Error searching author's recent papers:`, error);
    return {
      success: false,
      message: "Error al buscar los artículos recientes.",
    };
  }
}

module.exports = {
  searchPapersByKeywords,
  searchAuthorRecentPapers,
  getPaperDetails,
};
