/**
 * Spotify API Service
 * 
 * Handles Spotify API authentication, track search, and preview download.
 */

import SpotifyWebApi from 'spotify-web-api-node';
import fetch from 'node-fetch';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const FETCH_TIMEOUT = 5000;

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
 * Sanitizes search query by removing special characters
 * @param {string} query - Search query
 * @returns {string} Sanitized query
 */
function sanitizeQuery(query) {
  return query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[&/\\#,+()$~%.'":*?<>{}!¡¿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Creates Spotify API service
 * @param {Object} config - Configuration object
 * @param {string} config.spotifyClientId - Spotify client ID
 * @param {string} config.spotifyClientSecret - Spotify client secret
 * @returns {Object} Spotify service
 */
function createSpotifyService(config) {
  if (!config.spotifyClientId || !config.spotifyClientSecret) {
    throw new Error('Spotify credentials not configured');
  }

  const spotifyApi = new SpotifyWebApi({
    clientId: config.spotifyClientId,
    clientSecret: config.spotifyClientSecret,
  });

  /**
   * Refreshes Spotify access token
   * @returns {Promise<string>} Access token
   */
  async function refreshAccessToken() {
    try {
      const data = await spotifyApi.clientCredentialsGrant();
      const token = data.body['access_token'];
      spotifyApi.setAccessToken(token);
      return token;
    } catch (error) {
      console.error('Error refreshing Spotify access token:', error);
      throw error;
    }
  }

  /**
   * Gets preview URL from Spotify embed page
   * @param {string} trackId - Spotify track ID
   * @returns {Promise<string|null>} Preview URL or null
   */
  async function getSpotifyPreviewUrl(trackId) {
    try {
      const response = await fetchWithTimeout(
        `https://open.spotify.com/embed/track/${trackId}`
      );
      const html = await response.text();
      const match = html.match(/audioPreview":\s*{\s*"url":\s*"([^"]+)"/);
      return match ? match[1] : null;
    } catch (error) {
      console.error('Failed to fetch preview URL:', error);
      return null;
    }
  }

  /**
   * Searches for track on Spotify
   * @param {string} query - Search query
   * @returns {Promise<Object|null>} Track object or null
   */
  async function searchTrack(query) {
    if (!spotifyApi.getAccessToken()) {
      await refreshAccessToken();
    }

    try {
      const result = await spotifyApi.searchTracks(sanitizeQuery(query), {
        limit: 1,
      });
      return result.body.tracks.items[0] || null;
    } catch (error) {
      if (error.statusCode === 401) {
        // Token expired, refresh and retry
        await refreshAccessToken();
        const result = await spotifyApi.searchTracks(sanitizeQuery(query), {
          limit: 1,
        });
        return result.body.tracks.items[0] || null;
      }
      throw error;
    }
  }

  /**
   * Downloads audio from URL
   * @param {string} url - Audio URL
   * @param {string} filePath - Destination file path
   * @returns {Promise<void>}
   */
  async function downloadAudio(url, filePath) {
    const response = await fetchWithTimeout(url);
    const buffer = await response.buffer();
    await writeFile(filePath, buffer);
  }

  /**
   * Searches for track and downloads preview
   * @param {string} query - Search query
   * @returns {Promise<Object|null>} Track info with file path or null
   */
  async function searchAndDownload(query) {
    try {
      const track = await searchTrack(query);
      
      if (!track) {
        return null;
      }

      // Get preview URL (from API or embed page)
      const previewUrl = track.preview_url || (await getSpotifyPreviewUrl(track.id));

      if (!previewUrl) {
        console.log('No preview URL available for track:', track.id);
        return null;
      }

      // Download to temp directory
      const fileName = `spotify_${track.id}_${Date.now()}.mp3`;
      const filePath = join(tmpdir(), fileName);

      await downloadAudio(previewUrl, filePath);

      return {
        name: track.name,
        artist: track.artists?.[0]?.name || 'Unknown Artist',
        filePath,
      };
    } catch (error) {
      console.error('Error in searchAndDownload:', error);
      throw error;
    }
  }

  return {
    searchTrack,
    searchAndDownload,
    refreshAccessToken,
  };
}

export { createSpotifyService };


