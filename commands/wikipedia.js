const fetch = require(`node-fetch`);
let languageCode;

const BASE_WIKI_API_URL = `https://{lang}.wikipedia.org/api/rest_v1/page/summary/{query}`;
const DISAMBIGUATION_API_URL = `https://{lang}.wikipedia.org/w/api.php?format=json&action=query&prop=links&plnamespace=0&titles={query}`;
const SEARCH_API_URL = `https://{lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch={query}&format=json`;

const fetchJson = async (url) => {
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch from the url: ${url}`, error);
  }
};

async function getWikiArticle(
  message,
  query,
  languageCode,
  senderName,
  client,
  MessageMedia
) {
  try {
    const urls = [
      BASE_WIKI_API_URL.replace(`{lang}`, languageCode).replace(
        `{query}`,
        query
      ),
      DISAMBIGUATION_API_URL.replace(`{lang}`, languageCode).replace(
        `{query}`,
        query
      ),
      SEARCH_API_URL.replace(`{lang}`, languageCode).replace(`{query}`, query),
    ];

    const [apiData, linksData, searchData] = await Promise.all(
      urls.map((url) => fetchJson(url))
    );

    const handleDisambiguation = async () => {
      const pageId = Object.keys(linksData.query.pages)[0];
      const links = linksData.query.pages[pageId].links;
      const filteredLinks = links.filter(
        (link) => link.title.includes(`(`) && link.title !== `Wikcionario`
      );
      const linksMessage = filteredLinks
        .map(
          (link) =>
            `• ${
              link.title
            } - https://${languageCode}.wikipedia.org/wiki/${link.title.replace(
              / /g,
              `_`
            )}`
        )
        .join(`\n`);

      message.reply(
        `🤖 ${senderName}, tu búsqueda dio resultados ambiguos, aquí están los posibles artículos que puedes considerar:\n${linksMessage}`
      );
      message.reply(`🤖 Te mandaremos el primer resultado en unos momentos.`);

      const firstResultQuery = filteredLinks[0].title;
      const firstResultUrl = BASE_WIKI_API_URL.replace(
        `{lang}`,
        languageCode
      ).replace(`{query}`, firstResultQuery);
      const firstResultData = await fetchJson(firstResultUrl);

      await handleSuccess(firstResultData);
    };

    const handleNotFound = async () => {
      if (searchData.query.searchinfo.totalhits === 0) {
        message.reply(`🤖 ${senderName}, tu búsqueda no dió resultados.`);
      } else {
        const similarArticles = searchData.query.search;
        const firstSimilarArticleTitle = similarArticles[0].title.replace(
          / /g,
          `_`
        );

        const similarArticleUrl = BASE_WIKI_API_URL.replace(
          `{lang}`,
          languageCode
        ).replace(`{query}`, firstSimilarArticleTitle);
        const similarArticleData = await fetchJson(similarArticleUrl);

        await handleSuccess(similarArticleData);
      }
    };

    const handleSuccess = async (data) => {
      const summary = `🤖 *${data.title}*: ${data.extract}`;

      if (data.originalimage) {
        const imageMedia = await MessageMedia.fromUrl(
          data.originalimage.source
        );
        client.sendMessage(message.id.remote, imageMedia, {
          caption: summary,
        });
      } else {
        message.reply(summary);
      }
    };

    switch (apiData.type) {
      case `disambiguation`:
        await handleDisambiguation();
        break;
      case `https://mediawiki.org/wiki/HyperSwitch/errors/not_found`:
        await handleNotFound();
        break;
      default:
        await handleSuccess(apiData);
    }
  } catch (err) {
    console.error(err);
  }
}

function handleWikipediaRequest(
  stringifyMessage,
  message,
  robotEmoji,
  query,
  senderName,
  client,
  MessageMedia
) {
  languageCode = stringifyMessage[0].substring(3) || `es`;
  if (stringifyMessage.length < 2 || languageCode.length !== 2) {
    message.reply(
      `${robotEmoji} ${
        stringifyMessage.length < 2
          ? `Adjunta un enlace o una búsqueda de Wikipedia.`
          : `Asegúrate de usar un código de idioma válido de 2 letras.`
      }`
    );
    return;
  }
  getWikiArticle(
    message,
    query,
    languageCode,
    senderName,
    client,
    MessageMedia
  );
}

module.exports = {
  handleWikipediaRequest,
};
