// Usage:
//   bun papers.ts "Author Name"
//
// Example:
//   bun papers.ts "Yann LeCun"

const SEMANTIC_SCHOLAR_BASE_URL = "https://api.semanticscholar.org/graph/v1/";

type PaperFromApi = {
  title: string;
  year?: number;
  externalIds?: { DOI?: string };
};

type AuthorSearchResponse = {
  data: { papers?: PaperFromApi[] }[];
};

type PaperSummary = {
  title: string;
  year?: number;
  doi?: string | null;
};

async function fetchFromSemanticScholar(
  path: string,
  queryParams: Record<string, string>,
) {
  const url = new URL(path, SEMANTIC_SCHOLAR_BASE_URL);
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Semantic Scholar request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

async function findRecentPapersByAuthor(
  authorName: string,
  maxResults = 5,
): Promise<PaperSummary[]> {
  const json = (await fetchFromSemanticScholar("author/search", {
    query: authorName,
    fields: "papers.title,papers.year,papers.externalIds",
    limit: "1",
  })) as AuthorSearchResponse;

  const author = json.data?.[0];
  const papers = author?.papers ?? [];

  return papers
    .slice()
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .slice(0, maxResults)
    .map((paper) => ({
      title: paper.title,
      year: paper.year,
      doi: paper.externalIds?.DOI ?? null,
    }));
}

function formatPaperList(authorName: string, papers: PaperSummary[]): string {
  if (papers.length === 0) {
    return `No recent papers found for "${authorName}".`;
  }

  const list = papers
    .map((paper, index) => {
      const yearPart = paper.year ? ` (${paper.year})` : "";
      const doiPart = paper.doi ? `\n   DOI: https://doi.org/${paper.doi}` : "";
      return `${index + 1}. ${paper.title}${yearPart}${doiPart}`;
    })
    .join("\n\n");

  return `Recent papers by ${authorName}:\n\n${list}`;
}

function parseAuthorName(argv: string[]): string {
  const [, , ...rest] = argv;
  const authorName = rest.join(" ").trim();

  if (!authorName) {
    throw new Error(
      [
        "Usage:",
        '  bun papers.ts "Author Name"',
        "",
        "Example:",
        '  bun papers.ts "Yann LeCun"',
      ].join("\n"),
    );
  }

  return authorName;
}

async function main() {
  try {
    const authorName = parseAuthorName(process.argv);
    const papers = await findRecentPapersByAuthor(authorName);
    console.log(formatPaperList(authorName, papers));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error while searching papers.";
    console.error(message);
    process.exit(1);
  }
}

await main();
