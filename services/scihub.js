const fetch = require("node-fetch");

const SCIHUB_BASE_URL = "https://sci-hub.scrongyao.com/"; // https://pismin.com/

function extractTitle(htmlContent) {
  let decodedContent = htmlContent
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

  let previous;
  do {
    previous = decodedContent;
    decodedContent = decodedContent.replace(/<\/?[^>]+>/g, "");
  } while (decodedContent !== previous);

  return decodedContent.replace(/\s\s+/g, " ").trim();
}

async function fetchArticle(input) {
  const response = await fetch(`${SCIHUB_BASE_URL}${input}`);
  const html = await response.text();

  const articleDiv = /<div\s+id="article">(.*?)<\/div>/s.exec(html);
  const citationDiv = /<div\s+id="citation"[^>]*>(.*?)<\/div>/s.exec(html);

  let title = null;
  if (citationDiv && citationDiv[1]) {
    title = extractTitle(citationDiv[1]);
  }

  let pdfLink = null;
  if (articleDiv && articleDiv[1]) {
    const pdfEmbedTag =
      /<embed\s+type="application\/pdf"\s+src="(.*?)"\s+id="pdf"/s.exec(
        articleDiv[1]
      );
    if (pdfEmbedTag && pdfEmbedTag[1]) {
      pdfLink = pdfEmbedTag[1];
    }
  }

  return { title, pdfLink };
}

module.exports = { fetchArticle };
