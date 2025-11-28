import { retry } from "../lib/retry";
import { executeWithCircuitBreaker } from "../lib/circuit-breaker";
import { withTimeout } from "../lib/timeout";
import { TIMEOUTS } from "../config";
import { log } from "../lib/logger";

export interface SpotifyTrackInfo {
  readonly name: string;
  readonly artists: string[];
  readonly albumName: string;
  readonly previewUrl: string;
}

export class SpotifyAdapter {
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
      return await executeWithCircuitBreaker("spotify", async () => {
        return retry(async () => {
          return withTimeout(async () => {
            const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
              query
            )}&type=track&limit=1`;
            const resp = await fetch(url, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!resp.ok) {
              const text = await resp.text();
              throw new Error(`Spotify search failed: ${resp.status} ${text}`);
            }

            const json = (await resp.json()) as any;
            const item = json.tracks?.items?.[0];
            if (!item) return null;

            const trackId = item.id;
            const previewUrl = await this.scrapePreviewUrl(trackId);
            if (!previewUrl) return null;

            return {
              name: item.name,
              artists: item.artists.map((a: any) => a.name),
              albumName: item.album?.name || "",
              previewUrl,
            };
          }, TIMEOUTS.EXTERNAL_API_MS);
        }, "spotify-search");
      });
    } catch (error) {
      log("error", "Spotify search error", {
        error: error instanceof Error ? error.message : String(error),
        query,
      });
      return null;
    }
  }

  private async getToken(): Promise<string | null> {
    if (!this.clientId || !this.clientSecret) return null;

    if (this.token && Date.now() < this.tokenExpiry - 5000) {
      return this.token;
    }

    try {
      return await executeWithCircuitBreaker("spotify", async () => {
        return retry(async () => {
          return withTimeout(async () => {
            const auth = Buffer.from(
              `${this.clientId}:${this.clientSecret}`
            ).toString("base64");

            const resp = await fetch("https://accounts.spotify.com/api/token", {
              method: "POST",
              headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: "grant_type=client_credentials",
            });

            if (!resp.ok) {
              const text = await resp.text();
              throw new Error(
                `Spotify token request failed: ${resp.status} ${text}`
              );
            }

            const json = (await resp.json()) as any;
            if (!json.access_token || !json.expires_in) {
              throw new Error("Invalid token response from Spotify");
            }

            this.token = json.access_token as string;
            this.tokenExpiry = Date.now() + (json.expires_in as number) * 1000;

            return this.token;
          }, TIMEOUTS.EXTERNAL_API_MS);
        }, "spotify-token");
      });
    } catch (error) {
      log("error", "Failed to get Spotify token", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async scrapePreviewUrl(trackId: string): Promise<string | null> {
    try {
      return await executeWithCircuitBreaker("spotify", async () => {
        return retry(async () => {
          return withTimeout(async () => {
            const url = `https://open.spotify.com/embed/track/${trackId}`;
            const resp = await fetch(url, { method: "GET" });
            if (!resp.ok) {
              throw new Error(`Spotify embed fetch failed: ${resp.status}`);
            }
            const html = await resp.text();

            const match = html.match(
              /audioPreview"\s*:\s*{\s*"url"\s*:\s*"([^"]+)"/
            );
            if (!match || !match[1]) return null;

            return match[1].replace(/\\u0026/g, "&");
          }, TIMEOUTS.EXTERNAL_API_MS);
        }, "spotify-scrape-preview");
      });
    } catch (error) {
      log("debug", "Failed to scrape preview URL", {
        error: error instanceof Error ? error.message : String(error),
        trackId,
      });
      return null;
    }
  }
}
