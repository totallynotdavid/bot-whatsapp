import { retry } from "../../lib/resilience/retry";
import { executeWithCircuitBreaker } from "../../lib/resilience/circuit-breaker";
import { withTimeout } from "../../lib/resilience/timeout";
import { TIMEOUTS } from "../../config/constants";
import { log } from "../../lib/logging/logger";

const CIRCUIT_BREAKER_SERVICE_NAME = "spotify";
const TOKEN_BUFFER_MS = 5000;

export interface SpotifyTrackInfo {
  readonly name: string;
  readonly artists: string[];
  readonly albumName: string;
  readonly previewUrl: string;
}

export class SpotifyClient {
  private token?: string;
  private tokenExpiry = 0;

  constructor(
    private readonly clientId?: string,
    private readonly clientSecret?: string
  ) {}

  async searchTrack(query: string): Promise<SpotifyTrackInfo | null> {
    const token = await this.getToken();
    if (!token) return null;

    try {
      return await executeWithCircuitBreaker(
        CIRCUIT_BREAKER_SERVICE_NAME,
        async () => {
          return retry(async () => {
            return withTimeout(
              async () => {
                const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`;
                const response = await fetch(searchUrl, {
                  method: "GET",
                  headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) {
                  const text = await response.text();
                  throw new Error(
                    `Spotify search failed: ${response.status} ${text}`
                  );
                }

                const json = (await response.json()) as any;
                const item = json.tracks?.items?.[0];

                if (!item) return null;

                const trackId = item.id;
                const previewUrl = await this.scrapePreviewUrl(trackId);

                if (!previewUrl) return null;

                return {
                  name: item.name,
                  artists: item.artists.map((artist: any) => artist.name),
                  albumName: item.album?.name || "",
                  previewUrl,
                };
              },
              TIMEOUTS.EXTERNAL_API_MS,
              "spotify-search"
            );
          }, "spotify-search");
        }
      );
    } catch (error) {
      log("error", "Spotify search failed", {
        error: error instanceof Error ? error.message : String(error),
        query,
      });
      return null;
    }
  }

  private async getToken(): Promise<string | null> {
    if (!this.clientId || !this.clientSecret) return null;

    if (this.token && Date.now() < this.tokenExpiry - TOKEN_BUFFER_MS) {
      return this.token;
    }

    try {
      return await executeWithCircuitBreaker(
        CIRCUIT_BREAKER_SERVICE_NAME,
        async () => {
          return retry(async () => {
            return withTimeout(
              async () => {
                const auth = Buffer.from(
                  `${this.clientId}:${this.clientSecret}`
                ).toString("base64");

                const response = await fetch(
                  "https://accounts.spotify.com/api/token",
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Basic ${auth}`,
                      "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: "grant_type=client_credentials",
                  }
                );

                if (!response.ok) {
                  const text = await response.text();
                  throw new Error(
                    `Spotify token request failed: ${response.status} ${text}`
                  );
                }

                const json = (await response.json()) as any;

                if (!json.access_token || !json.expires_in) {
                  throw new Error("Invalid token response from Spotify");
                }

                this.token = json.access_token as string;
                this.tokenExpiry =
                  Date.now() + (json.expires_in as number) * 1000;

                return this.token;
              },
              TIMEOUTS.EXTERNAL_API_MS,
              "spotify-token"
            );
          }, "spotify-token");
        }
      );
    } catch (error) {
      log("error", "Failed to get Spotify token", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async scrapePreviewUrl(trackId: string): Promise<string | null> {
    try {
      return await executeWithCircuitBreaker(
        CIRCUIT_BREAKER_SERVICE_NAME,
        async () => {
          return retry(async () => {
            return withTimeout(
              async () => {
                const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
                const response = await fetch(embedUrl, { method: "GET" });

                if (!response.ok) {
                  throw new Error(
                    `Spotify embed fetch failed: ${response.status}`
                  );
                }

                const html = await response.text();
                const match = html.match(
                  /audioPreview"\s*:\s*{\s*"url"\s*:\s*"([^"]+)"/
                );

                if (!match || !match[1]) return null;

                return match[1].replace(/\\u0026/g, "&");
              },
              TIMEOUTS.EXTERNAL_API_MS,
              "spotify-scrape-preview"
            );
          }, "spotify-scrape-preview");
        }
      );
    } catch (error) {
      log("debug", "Failed to scrape preview URL", {
        error: error instanceof Error ? error.message : String(error),
        trackId,
      });
      return null;
    }
  }
}
