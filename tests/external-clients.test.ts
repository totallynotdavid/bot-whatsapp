import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { AnnasArchiveClient } from "../src/infrastructure/external/annas-archive-client";
import { ImgurClient } from "../src/infrastructure/external/imgur-client";
import { SpotifyClient } from "../src/infrastructure/external/spotify-client";
import { loadTestConfig } from "./fixtures";

loadTestConfig();

type Route = (request: IncomingMessage, response: ServerResponse) => void;

// A real HTTP server, so the clients run their own fetch, status handling and
// abort wiring unmodified.
class LocalServer {
  readonly hits = new Map<string, number>();
  readonly routes = new Map<string, Route>();
  private server?: Server;
  url = "";

  async start(): Promise<void> {
    this.server = createServer((request, response) => {
      const path = new URL(request.url ?? "/", "http://localhost").pathname;
      this.hits.set(path, (this.hits.get(path) ?? 0) + 1);
      const route = this.routes.get(path);
      if (route) route(request, response);
      else response.writeHead(404).end();
    });
    await new Promise<void>((resolve) =>
      this.server!.listen(0, "127.0.0.1", resolve)
    );
    const { port } = this.server.address() as AddressInfo;
    this.url = `http://127.0.0.1:${port}`;
  }

  async stop(): Promise<void> {
    this.server?.closeAllConnections();
    await new Promise((resolve) => this.server?.close(resolve));
  }
}

function json(body: unknown): Route {
  return (_, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  };
}

function status(code: number): Route {
  return (_, response) => response.writeHead(code).end();
}

function stalled(): Route {
  return () => {};
}

function abortAfter(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error("job timed out")), ms);
  return controller.signal;
}

let server: LocalServer;

beforeEach(async () => {
  server = new LocalServer();
  await server.start();
});

afterEach(async () => {
  await server.stop();
});

describe("SpotifyClient", () => {
  function spotify(): SpotifyClient {
    return new SpotifyClient("id", "secret", {
      accounts: server.url,
      api: server.url,
      embed: server.url,
    });
  }

  beforeEach(() => {
    server.routes.set(
      "/api/token",
      json({ access_token: "token", expires_in: 3600 })
    );
    server.routes.set(
      "/v1/search",
      json({
        tracks: {
          items: [
            {
              id: "track-1",
              name: "Monaco",
              artists: [{ name: "Bad Bunny" }],
              album: { name: "Nadie Sabe" },
            },
          ],
        },
      })
    );
    server.routes.set("/embed/track/track-1", (_, response) => {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(
        '<script>{"audioPreview": {"url": "https://p.scdn.co/mp3?a=1\\u0026b=2"}}</script>'
      );
    });
  });

  test("finds a track and its preview", async () => {
    expect(await spotify().searchTrack("monaco")).toEqual({
      name: "Monaco",
      artists: ["Bad Bunny"],
      albumName: "Nadie Sabe",
      previewUrl: "https://p.scdn.co/mp3?a=1&b=2",
    });
  });

  test("returns null when no track matches", async () => {
    server.routes.set("/v1/search", json({ tracks: { items: [] } }));

    expect(await spotify().searchTrack("nada")).toBeNull();
  });

  test("returns null when the track has no preview", async () => {
    server.routes.set("/embed/track/track-1", json({}));

    expect(await spotify().searchTrack("monaco")).toBeNull();
  });

  test("an HTTP failure throws after a single request", async () => {
    server.routes.set("/v1/search", status(503));

    await expect(spotify().searchTrack("monaco")).rejects.toThrow(
      "Spotify search failed: 503"
    );
    expect(server.hits.get("/v1/search")).toBe(1);
  });

  test("missing credentials throw", async () => {
    await expect(new SpotifyClient().searchTrack("monaco")).rejects.toThrow(
      "Spotify credentials are not configured"
    );
  });

  test("an aborted signal stops a stalled search", async () => {
    server.routes.set("/v1/search", stalled());
    const started = Date.now();

    await expect(
      spotify().searchTrack("monaco", abortAfter(20))
    ).rejects.toThrow("job timed out");
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("AnnasArchiveClient", () => {
  test("downloads a book", async () => {
    server.routes.set("/file.epub", (_, response) =>
      response.writeHead(200).end("book-bytes")
    );

    const book = await new AnnasArchiveClient().downloadBook(
      `${server.url}/file.epub`
    );

    expect(book?.toString()).toBe("book-bytes");
  });

  test("returns null when the mirror has no such file", async () => {
    expect(
      await new AnnasArchiveClient().downloadBook(`${server.url}/gone.epub`)
    ).toBeNull();
  });

  test("an HTTP failure throws after a single request", async () => {
    server.routes.set("/file.epub", status(502));

    await expect(
      new AnnasArchiveClient().downloadBook(`${server.url}/file.epub`)
    ).rejects.toThrow("Download failed: 502");
    expect(server.hits.get("/file.epub")).toBe(1);
  });

  test("an aborted signal stops a stalled download", async () => {
    server.routes.set("/file.epub", stalled());
    const started = Date.now();

    await expect(
      new AnnasArchiveClient().downloadBook(
        `${server.url}/file.epub`,
        abortAfter(20)
      )
    ).rejects.toThrow("job timed out");
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test("a failed search throws instead of reporting no results, after its own retries", async () => {
    server.routes.set("/search", status(500));

    await expect(
      new AnnasArchiveClient(undefined, server.url).searchBooks("dune")
    ).rejects.toThrow("Search failed: 500");
    expect(server.hits.get("/search")).toBe(3);
  }, 10_000);
});

describe("ImgurClient", () => {
  test("uploading without a client ID throws", async () => {
    await expect(
      new ImgurClient().upload("https://pps.example/a.jpg")
    ).rejects.toThrow("Imgur client ID is not configured");
  });
});
