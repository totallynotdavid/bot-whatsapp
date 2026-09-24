import { executeWithCircuitBreaker } from "../../lib/resilience/circuit-breaker";
import { withTimeout } from "../../lib/resilience/timeout";
import { TIMEOUTS } from "../../config/constants";

const CIRCUIT_BREAKER_SERVICE_NAME = "spotify";
const TOKEN_BUFFER_MS = 5000;

export interface SpotifyTrackInfo {
  readonly name: string;
  readonly artists: string[];
  readonly albumName: string;
  readonly previewUrl: string;
}

export interface SpotifyEndpoints {
  readonly accounts: string;
  readonly api: string;
  readonly embed: string;
}

const SPOTIFY_ENDPOINTS: SpotifyEndpoints = {
  accounts: "https://accounts.spotify.com",
  api: "https://api.spotify.com",
  embed: "https://open.spotify.com",
};

export class SpotifyClient {
  private token?: string;
  private tokenExpiry = 0;

  constructor(
    private readonly clientId?: string,
    private readonly clientSecret?: string,
    private readonly endpoints: SpotifyEndpoints = SPOTIFY_ENDPOINTS
  ) {}

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  // Null means Spotify has no matching track with a preview; every failure
  // to find out throws.
  async searchTrack(
    query: string,
    signal?: AbortSignal
  ): Promise<SpotifyTrackInfo | null> {
    const token = await this.getToken(signal);

    return executeWithCircuitBreaker(CIRCUIT_BREAKER_SERVICE_NAME, () =>
      withTimeout(
        async (callSignal) => {
          const searchUrl = `${this.endpoints.api}/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`;
          const response = await fetch(searchUrl, {
            headers: { Authorization: `Bearer ${token}` },
            signal: callSignal,
          });

          if (!response.ok) {
            throw new Error(
              `Spotify search failed: ${response.status} ${await response.text()}`
            );
          }

          const json = (await response.json()) as any;
          const item = json.tracks?.items?.[0];
          if (!item) return null;

          const previewUrl = await this.scrapePreviewUrl(item.id, callSignal);
          if (!previewUrl) return null;

          return {
            name: item.name,
            artists: item.artists.map((artist: any) => artist.name),
            albumName: item.album?.name || "",
            previewUrl,
          };
        },
        TIMEOUTS.EXTERNAL_API_MS,
        "spotify-search",
        signal
      )
    );
  }

  private async getToken(signal?: AbortSignal): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("Spotify credentials are not configured");
    }

    if (this.token && Date.now() < this.tokenExpiry - TOKEN_BUFFER_MS) {
      return this.token;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      "base64"
    );

    return executeWithCircuitBreaker(CIRCUIT_BREAKER_SERVICE_NAME, () =>
      withTimeout(
        async (callSignal) => {
          const response = await fetch(`${this.endpoints.accounts}/api/token`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
            signal: callSignal,
          });

          if (!response.ok) {
            throw new Error(
              `Spotify token request failed: ${response.status} ${await response.text()}`
            );
          }

          const json = (await response.json()) as any;
          if (!json.access_token || !json.expires_in) {
            throw new Error("Invalid token response from Spotify");
          }

          this.token = json.access_token as string;
          this.tokenExpiry = Date.now() + (json.expires_in as number) * 1000;
          return this.token;
        },
        TIMEOUTS.EXTERNAL_API_MS,
        "spotify-token",
        signal
      )
    );
  }

  private async scrapePreviewUrl(
    trackId: string,
    signal: AbortSignal
  ): Promise<string | null> {
    const response = await fetch(
      `${this.endpoints.embed}/embed/track/${trackId}`,
      { signal }
    );

    if (!response.ok) {
      throw new Error(`Spotify embed fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const match = html.match(/audioPreview"\s*:\s*{\s*"url"\s*:\s*"([^"]+)"/);
    return match?.[1] ? match[1].replace(/\\u0026/g, "&") : null;
  }
}
