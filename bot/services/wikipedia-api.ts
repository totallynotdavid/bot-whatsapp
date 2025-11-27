/**
 * Wikipedia API Service
 *
 * Handles Wikipedia API calls for article summaries and search.
 */

import fetch from 'node-fetch';

const FETCH_TIMEOUT = 10000;

/**
 * Fetches JSON from URL with timeout
 * @param {string} url - URL to fetch
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} JSON response
 */
async function fetchJson(url, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.tson();
    clearTimeout(timeoutId);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Creates Wikipedia API service
 * @param {Object} config - Configuration object
 * @returns {Object} Wikipedia service
 */
function createWikipediaService(config) {
  const BASE_WIKI_API_URL = 'https://{lang}.wikipedia.org/api/rest_v1/page/summary/{query}';
  const DISAMBIGUATION_API_URL = 'https://{lang}.wikipedia.org/w/api.php?format=json&action=query&prop=links&plnamespace=0&titles={query}';
  const SEARCH_API_URL = 'https://{lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch={query}&format=json';

  /**
   * Gets article summary from Wikipedia
   * @param {string} query - Article title or search query
   * @param {string} lang - Language code (default: 'es')
   * @returns {Promise<Object|null>} Article data or null
   */
  async function getArticle(query, lang = 'es') {
    try {
      // URLs for parallel fetching
      const urls = [
        BASE_WIKI_API_URL.replace('{lang}', lang).replace('{query}', encodeURIComponent(query)),
        DISAMBIGUATION_API_URL.replace('{lang}', lang).replace('{query}', encodeURIComponent(query)),
        SEARCH_API_URL.replace('{lang}', lang).replace('{query}', encodeURIComponent(query)),
      ];

      const [apiData, linksData, searchData] = await Promise.all(
        urls.map(url => fetchJson(url).catch(() => null))
      );

      // Handle disambiguation
      if (apiData?.type === 'disambiguation') {
        return await handleDisambiguation(linksData, lang);
      }

      // Handle not found
      if (apiData?.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found' ||
          !apiData?.title) {
        return await handleNotFound(searchData, lang);
      }

      // Success
      return {
        title: apiData.title,
        extract: apiData.extract,
        imageUrl: apiData.originalimage?.source,
      };
    } catch (error) {
      console.error('Wikipedia API error:', error);
      throw new Error('Error al consultar Wikipedia');
    }
  }

  /**
   * Handles disambiguation pages
   * @param {Object} linksData - Links data from API
   * @param {string} lang - Language code
   * @returns {Promise<Object|null>} Article data or null
   */
  async function handleDisambiguation(linksData, lang) {
    if (!linksData?.query?.pages) {
      return null;
    }

    const pageId = Object.keys(linksData.query.pages)[0];
    const links = linksData.query.pages[pageId].links;

    if (!links || links.length === 0) {
      return null;
    }

    // Filter out Wikcionario and get first valid link
    const filteredLinks = links.filter(
      link => link.title.includes('(') && link.title !== 'Wikcionario'
    );

    if (filteredLinks.length === 0) {
      return null;
    }

    // Get first result
    const firstResultQuery = filteredLinks[0].title;
    const firstResultUrl = BASE_WIKI_API_URL
      .replace('{lang}', lang)
      .replace('{query}', encodeURIComponent(firstResultQuery));

    try {
      const firstResultData = await fetchJson(firstResultUrl);
      return {
        title: firstResultData.title,
        extract: firstResultData.extract,
        imageUrl: firstResultData.originalimage?.source,
        disambiguationNote: `Tu búsqueda dio resultados ambiguos. Mostrando: ${firstResultData.title}`,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Handles not found articles
   * @param {Object} searchData - Search data from API
   * @param {string} lang - Language code
   * @returns {Promise<Object|null>} Article data or null
   */
  async function handleNotFound(searchData, lang) {
    if (!searchData?.query?.searchinfo?.totalhits ||
        searchData.query.searchinfo.totalhits === 0) {
      return null;
    }

    const similarArticles = searchData.query.search;
    if (!similarArticles || similarArticles.length === 0) {
      return null;
    }

    // Get first similar article
    const firstSimilarArticleTitle = similarArticles[0].title;
    const similarArticleUrl = BASE_WIKI_API_URL
      .replace('{lang}', lang)
      .replace('{query}', encodeURIComponent(firstSimilarArticleTitle));

    try {
      const similarArticleData = await fetchJson(similarArticleUrl);
      return {
        title: similarArticleData.title,
        extract: similarArticleData.extract,
        imageUrl: similarArticleData.originalimage?.source,
        notFoundNote: `Tu búsqueda no dio resultados exactos. Mostrando: ${similarArticleData.title}`,
      };
    } catch (error) {
      return null;
    }
  }

  return {
    getArticle,
  };
}

export { createWikipediaService };

