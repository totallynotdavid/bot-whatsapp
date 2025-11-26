const SpotifyWebApi = require("spotify-web-api-node");
const fetch = require("node-fetch");
const path = require("path");
const audioService = require("./audio");

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: `http://localhost:3000`,
});

const FETCH_TIMEOUT = 5000;

const fetchWithTimeout = async (url) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

function sanitizeQuery(query) {
  return query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[&/\\#,+()$~%.'":*?<>{}!¡¿]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function refreshAccessToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    const token = data.body["access_token"];
    spotifyApi.setAccessToken(token);
    return token;
  } catch (error) {
    console.error("Error refreshing access token:", error);
    throw error;
  }
}

async function getSpotifyPreviewUrl(trackId) {
  try {
    const response = await fetchWithTimeout(
      `https://open.spotify.com/embed/track/${trackId}`
    );
    const html = await response.text();
    const match = html.match(/audioPreview":\s*{\s*"url":\s*"([^"]+)"/);
    return match ? match[1] : null;
  } catch (error) {
    console.error("Failed to fetch preview URL:", error);
    return null;
  }
}

async function searchSpotify(query) {
  if (!spotifyApi.getAccessToken()) {
    await refreshAccessToken();
  }

  try {
    const result = await spotifyApi.searchTracks(sanitizeQuery(query), {
      limit: 1,
    });
    return result.body.tracks.items[0];
  } catch (error) {
    if (error.statusCode === 401) {
      await refreshAccessToken();
      const result = await spotifyApi.searchTracks(sanitizeQuery(query), {
        limit: 1,
      });
      return result.body.tracks.items[0];
    }
    throw error;
  }
}

async function searchAndDownloadSong(query) {
  try {
    const song = await searchSpotify(query);
    if (!song) return null;

    const previewUrl =
      song.preview_url || (await getSpotifyPreviewUrl(song.id));

    if (!previewUrl) {
      console.log("No preview URL available, trying fallback");
      return null;
    }

    const fileName = `spotify_${song.id}.mp3`;
    const filePath = path.join(__dirname, "..", "audio", fileName);

    await audioService.downloadAudio(previewUrl, filePath);

    return {
      name: song.name || song.title,
      artist: song.artists?.[0].name || song.artist.name,
      filePath,
    };
  } catch (error) {
    console.error("Error in searchAndDownloadSong:", error);
    throw error;
  }
}

module.exports = { searchAndDownloadSong, refreshAccessToken };
