// Usage examples:
//   bun wiki.ts Einstein
//   bun wiki.ts es "Guerra civil española"

const SUMMARY_URL =
  "https://{lang}.wikipedia.org/api/rest_v1/page/summary/{title}";
const SEARCH_URL =
  "https://{lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch={query}&format=json&origin=*";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(
      "Usage:\n  node wiki.ts <query>\n  node wiki.ts <lang> <query>",
    );
    process.exit(1);
  }

  let lang = "en";
  let query: string;

  if (args[0].length === 2 && /^[a-zA-Z]{2}$/.test(args[0])) {
    lang = args[0].toLowerCase();
    query = args.slice(1).join(" ").trim();
  } else {
    query = args.join(" ").trim();
  }

  if (!query) {
    console.error("Please provide a search query.");
    process.exit(1);
  }

  const buildSummaryUrl = (title: string) =>
    SUMMARY_URL.replace("{lang}", lang).replace(
      "{title}",
      encodeURIComponent(title.replace(/ /g, "_")),
    );

  const buildSearchUrl = (term: string) =>
    SEARCH_URL.replace("{lang}", lang).replace(
      "{query}",
      encodeURIComponent(term),
    );

  try {
    // 1. Try direct page summary
    let response = await fetch(buildSummaryUrl(query));
    let summary = await response.json();

    let usedSearchFallback = false;

    const isNotFound =
      summary.type ===
      "https://mediawiki.org/wiki/HyperSwitch/errors/not_found";
    const isDisambiguation = summary.type === "disambiguation";

    // 2. If disambiguation or not found, use search API to pick the best match
    if (isNotFound || isDisambiguation) {
      const searchResponse = await fetch(buildSearchUrl(query));
      const searchData = await searchResponse.json();
      const bestTitle = searchData?.query?.search?.[0]?.title;

      if (!bestTitle) {
        console.error(
          `No Wikipedia article found for "${query}" in language "${lang}".`,
        );
        process.exit(1);
      }

      response = await fetch(buildSummaryUrl(bestTitle));
      summary = await response.json();
      usedSearchFallback = true;
    }

    const pageUrl =
      summary?.content_urls?.desktop?.page ??
      `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(
        String(summary.title || "").replace(/ /g, "_"),
      )}`;

    const header = usedSearchFallback
      ? `${summary.title} — Wikipedia (${lang}) [best match for: "${query}"]`
      : `${summary.title} — Wikipedia (${lang})`;

    console.log(header + "\n");
    console.log(String(summary.extract || "").trim());
    console.log(`\nRead more: ${pageUrl}`);
  } catch (error) {
    console.error("Error fetching Wikipedia article:", error);
    process.exit(1);
  }
}

main();
