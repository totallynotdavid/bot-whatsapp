const fetch = require("node-fetch");
const API_URL = "https://api.lyrics.ovh";

async function searchSongs(term) {
  try {
    const response = await fetch(
      `${API_URL}/suggest/${encodeURIComponent(term)}`
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error searching songs:", error);
    throw error;
  }
}

async function fetchLyrics(artist, song) {
  try {
    const url = `${API_URL}/v1/${encodeURIComponent(
      artist
    )}/${encodeURIComponent(song)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching lyrics:", error);
    throw error;
  }
}

function cleanLyrics(lyrics) {
  let result = "";
  let newlineCount = 0;

  for (let i = 0; i < lyrics.length; i++) {
    let char = lyrics[i];

    if (char === "\n") {
      newlineCount++;
    } else {
      if (newlineCount > 0) {
        if (newlineCount === 2) {
          result += "\n";
        } else if (newlineCount >= 3) {
          result += "\n\n";
        }
        newlineCount = 0;
      }
      result += char;
    }
  }

  return result;
}

async function getLyrics(songName) {
  try {
    const songs = await searchSongs(songName);
    if (!songs.data || songs.data.length === 0) {
      throw new Error("No songs found");
    }
    const firstSong = songs.data[0];
    const lyricsData = await fetchLyrics(
      firstSong.artist.name,
      firstSong.title
    );
    return {
      title: firstSong.title,
      artist: firstSong.artist.name,
      lyrics: cleanLyrics(lyricsData.lyrics),
    };
  } catch (error) {
    console.error("Error in getLyrics:", error);
    return null;
  }
}

async function handleSongLyricsRequest(songName) {
  if (!songName) {
    return { error: "No song name provided" };
  }
  try {
    const songLyrics = await getLyrics(songName);
    if (songLyrics && songLyrics.lyrics) {
      return {
        success: true,
        title: songLyrics.title,
        artist: songLyrics.artist,
        lyrics: songLyrics.lyrics,
      };
    } else {
      return { error: "Lyrics not found" };
    }
  } catch (error) {
    console.error(error);
    return { error: "Error fetching lyrics" };
  }
}

module.exports = {
  handleSongLyricsRequest,
};
