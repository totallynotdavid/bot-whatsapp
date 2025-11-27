/**
 * Sci-Hub Service
 *
 * Handles Sci-Hub article fetching and PDF downloading.
 */

import fetch from 'node-fetch';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const SCIHUB_BASE_URL = 'https://sci-hub.scrongyao.com/';
const FETCH_TIMEOUT = 30000;

/**
 * Fetches URL with timeout
 * @param {string} url - URL to fetch
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Extracts title from HTML content
 * @param {string} htmlContent - HTML content
 * @returns {string} Extracted title
 */
function extractTitle(htmlContent) {
  let decodedContent = htmlContent
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

  let previous;
  do {
    previous = decodedContent;
    decodedContent = decodedContent.replace(/<\/?[^>]+>/g, '');
  } while (decodedContent !== previous);

  return decodedContent.replace(/\s\s+/g, ' ').trim();
}

/**
 * Fetches article information from Sci-Hub
 * @param {string} input - DOI or search query
 * @returns {Promise<{title: string|null, pdfLink: string|null}>} Article info
 */
async function fetchArticle(input) {
  try {
    const response = await fetchWithTimeout(`${SCIHUB_BASE_URL}${input}`);
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
  } catch (error) {
    console.error('Error fetching from Sci-Hub:', error);
    throw error;
  }
}

/**
 * Downloads PDF from URL to temp file
 * @param {string} pdfLink - PDF URL
 * @param {string} identifier - Identifier for filename
 * @returns {Promise<{path: string, type: string}>} File path and type
 */
async function downloadPdf(pdfLink, identifier) {
  try {
    const response = await fetchWithTimeout(pdfLink);

    if (!response.ok) {
      throw new Error(
        `Failed to download PDF: ${response.status} ${response.statusText}`
      );
    }

    const buffer = await response.buffer();

    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const sanitizedIdentifier = identifier.replace(/\//g, '_');
    const fileName = `${sanitizedIdentifier}_${timestamp}.pdf`;
    const filePath = join(tmpdir(), fileName);

    await writeFile(filePath, buffer);

    return { path: filePath, type: 'document' };
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw error;
  }
}

/**
 * Fetches paper details from Semantic Scholar (if DOI)
 * @param {string} doi - DOI string
 * @returns {Promise<Object|null>} Paper details or null
 */
async function getPaperDetails(doi) {
  try {
    const paperId = `DOI:${doi}`;
    const endpoint = `https://api.semanticscholar.org/graph/v1/paper/${paperId}`;
    const fields = 'title,authors,year,abstract';

    const response = await fetchWithTimeout(`${endpoint}?fields=${fields}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.tson();
    return {
      ...data,
      authors: data.authors ? data.authors.map(({ name }) => name) : [],
    };
  } catch (error) {
    console.error('Error fetching paper details:', error);
    return null;
  }
}

export {
  fetchArticle,
  downloadPdf,
  getPaperDetails,
};

