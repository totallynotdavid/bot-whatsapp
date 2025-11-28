import * as cheerio from "cheerio";
import { retry } from "../lib/retry";
import { executeWithCircuitBreaker } from "../lib/circuit-breaker";
import { withTimeout } from "../lib/timeout";
import { TIMEOUTS } from "../config";
import { log } from "../lib/logger";

export interface BookData {
  readonly title: string;
  readonly author?: string;
  readonly thumbnail?: string;
  readonly link: string;
  readonly md5: string;
  readonly publisher?: string;
  readonly info?: string;
}

export interface BookInfo extends BookData {
  readonly mirror?: string;
  readonly description?: string;
  readonly format: string;
}

export class AnnasSearchAdapter {
  private static readonly BASE_URL = "https://annas-archive.org";
  private static readonly USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36";

  async searchBooks(query: string, limit = 5): Promise<BookData[]> {
    if (!query || query.length > 100) {
      throw new Error("Invalid query");
    }

    try {
      return await executeWithCircuitBreaker("annas-archive", async () => {
        return retry(async () => {
          return withTimeout(async () => {
            const encodedQuery = encodeURIComponent(query);
            const url = `${AnnasSearchAdapter.BASE_URL}/search?q=${encodedQuery}`;
            const resp = await fetch(url, {
              method: "GET",
              headers: {
                "User-Agent": AnnasSearchAdapter.USER_AGENT,
              },
            });

            if (!resp.ok) {
              throw new Error(`Search failed: ${resp.status}`);
            }

            const html = await resp.text();
            const books = this.parseSearchResults(html);
            return books.slice(0, limit);
          }, TIMEOUTS.EXTERNAL_API_MS);
        }, "annas-search");
      });
    } catch (error) {
      log("error", "Annas Archive search error", {
        error: error instanceof Error ? error.message : String(error),
        query,
      });
      return [];
    }
  }

  async getBookInfo(url: string): Promise<BookInfo | null> {
    try {
      return await executeWithCircuitBreaker("annas-archive", async () => {
        return retry(async () => {
          return withTimeout(async () => {
            const resp = await fetch(url, {
              method: "GET",
              headers: {
                "User-Agent": AnnasSearchAdapter.USER_AGENT,
              },
            });

            if (!resp.ok) {
              throw new Error(`Book info failed: ${resp.status}`);
            }

            const html = await resp.text();
            return this.parseBookInfo(html, url);
          }, TIMEOUTS.EXTERNAL_API_MS);
        }, "annas-book-info");
      });
    } catch (error) {
      log("error", "Annas Archive book info error", {
        error: error instanceof Error ? error.message : String(error),
        url,
      });
      return null;
    }
  }

  private parseSearchResults(html: string): BookData[] {
    const $ = cheerio.load(html);
    const books: BookData[] = [];

    $("div.flex.pt-3.pb-3.border-b").each((_, container) => {
      const $container = $(container);
      const mainLink = $container.find("a.line-clamp-\\[3\\].js-vim-focus");
      const thumbnail = $container.find('a[href^="/md5/"] img');

      if (!mainLink.length || !mainLink.attr("href")) return;

      const title = mainLink.text().trim();
      const link = AnnasSearchAdapter.BASE_URL + mainLink.attr("href")!;
      const md5 = this.getMd5(link);
      const thumbnailUrl = thumbnail.attr("src");

      let author: string | undefined;
      let publisher: string | undefined;

      const links = $container.find('a[href^="/search?q="]');
      if (links.length >= 1) author = $(links[0]).text().trim();
      if (links.length >= 2) publisher = $(links[1]).text().trim();

      const info = $container.find("div.text-gray-800").text().trim();

      const hasFileType = /(PDF|EPUB|CBR|CBZ)/i.test(info);
      if (!hasFileType) return;

      books.push({
        title,
        author: author || undefined,
        thumbnail: thumbnailUrl || undefined,
        link,
        md5,
        publisher: publisher || undefined,
        info: info || undefined,
      });
    });

    return books;
  }

  private parseBookInfo(html: string, url: string): BookInfo | null {
    const $ = cheerio.load(html);
    const main = $("div.main-inner");
    if (!main.length) return null;

    const slowDownloadLink = main.find(
      'ul.list-inside a[href*="/slow_download/"]'
    );
    const mirror = slowDownloadLink.length
      ? AnnasSearchAdapter.BASE_URL + slowDownloadLink.attr("href")!
      : undefined;

    const title =
      // @ts-expect-error
      main
        .find("div.font-semibold.text-2xl")
        .text()
        .trim()
        .split("<span")[0]
        .trim() || "";

    const authorLink = main.find('a[href^="/search?q="].text-base');
    const author = authorLink.length ? authorLink.text().trim() : "unknown";

    const publisherLink = authorLink.next('a[href^="/search?q="]');
    const publisher = publisherLink.length
      ? publisherLink.text().trim()
      : "unknown";

    const thumbnail = main.find('div[id^="list_cover_"] img').attr("src");

    const info = main.find("div.text-gray-800").text().trim();

    const descriptionLabel = main.find(
      "div.js-md5-top-box-description div.text-xs.text-gray-500.uppercase"
    );
    let description = "";
    if (
      descriptionLabel.length &&
      descriptionLabel.text().trim().toLowerCase() === "description"
    ) {
      description = descriptionLabel.next().text().trim();
    }

    const format = this.getFormat(info);
    const md5 = this.getMd5(url);

    return {
      title,
      author,
      thumbnail,
      publisher,
      info,
      link: url,
      md5,
      mirror,
      description,
      format,
    };
  }

  private getMd5(url: string): string {
    const segments = new URL(url).pathname.split("/");
    return segments[segments.length - 1] || "";
  }

  private getFormat(info: string): string {
    const lower = info.toLowerCase();
    if (lower.includes("pdf")) return "pdf";
    if (lower.includes("cbr")) return "cbr";
    if (lower.includes("cbz")) return "cbz";
    return "epub";
  }
}
