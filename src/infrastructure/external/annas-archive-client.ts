import * as cheerio from "cheerio";
import puppeteer from "puppeteer";
import { retry } from "../../lib/resilience/retry";
import { executeWithCircuitBreaker } from "../../lib/resilience/circuit-breaker";
import { withTimeout } from "../../lib/resilience/timeout";
import { TIMEOUTS } from "../../config/constants";

const BASE_URL = "https://annas-archive.org";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36";
const CIRCUIT_BREAKER_SERVICE_NAME = "annas-archive";
const SLOW_DOWNLOAD_WAIT_MS = 35000;

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

export class AnnasArchiveClient {
  private browser: any | null = null;

  constructor(
    private readonly chromePath?: string,
    private readonly baseUrl = BASE_URL
  ) {}

  // Search and book info serve /docs directly, so they retry here. Downloads
  // run as queue jobs, and BullMQ retries those.
  async searchBooks(query: string, limit = 5): Promise<BookData[]> {
    if (!query || query.length > 100) {
      throw new Error("Invalid query");
    }

    return executeWithCircuitBreaker(CIRCUIT_BREAKER_SERVICE_NAME, () =>
      retry(
        () =>
          withTimeout(
            async (signal) => {
              const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
              const response = await fetch(searchUrl, {
                headers: { "User-Agent": USER_AGENT },
                signal,
              });

              if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
              }

              return this.parseSearchResults(await response.text()).slice(
                0,
                limit
              );
            },
            TIMEOUTS.EXTERNAL_API_MS,
            "annas-search"
          ),
        "annas-search"
      )
    );
  }

  // Null means the page has no book on it.
  async getBookInfo(url: string): Promise<BookInfo | null> {
    return executeWithCircuitBreaker(CIRCUIT_BREAKER_SERVICE_NAME, () =>
      retry(
        () =>
          withTimeout(
            async (signal) => {
              const response = await fetch(url, {
                headers: { "User-Agent": USER_AGENT },
                signal,
              });

              if (!response.ok) {
                throw new Error(`Book info failed: ${response.status}`);
              }

              return this.parseBookInfo(await response.text(), url);
            },
            TIMEOUTS.EXTERNAL_API_MS,
            "annas-book-info"
          ),
        "annas-book-info"
      )
    );
  }

  // Null means the mirror has no file: no download link or a 404.
  async downloadBook(
    mirrorUrl: string,
    signal?: AbortSignal
  ): Promise<Buffer | null> {
    return executeWithCircuitBreaker(CIRCUIT_BREAKER_SERVICE_NAME, () =>
      withTimeout(
        async (callSignal) => {
          const downloadUrl = mirrorUrl.includes("/slow_download/")
            ? await this.resolveSlowDownloadUrl(mirrorUrl, callSignal)
            : mirrorUrl;
          if (!downloadUrl) return null;

          const response = await fetch(downloadUrl, {
            headers: { "User-Agent": USER_AGENT, Connection: "Keep-Alive" },
            signal: callSignal,
          });

          if (response.status === 404) return null;
          if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
          }

          return Buffer.from(await response.arrayBuffer());
        },
        TIMEOUTS.EXTERNAL_API_MS * 2,
        "annas-download",
        signal
      )
    );
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async getBrowser(): Promise<any> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: this.chromePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
        ],
      });
    }
    return this.browser;
  }

  private async resolveSlowDownloadUrl(
    mirrorUrl: string,
    signal: AbortSignal
  ): Promise<string | null> {
    signal.throwIfAborted();
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    // Puppeteer navigation and waits take no AbortSignal here; closing the page
    // makes whichever one is pending reject.
    const closePage = async () => {
      if (!page.isClosed()) await page.close();
    };
    signal.addEventListener("abort", closePage, { once: true });

    try {
      await page.goto(mirrorUrl, { waitUntil: "networkidle0" });
      await page.waitForSelector('a[href*="download"]', {
        timeout: SLOW_DOWNLOAD_WAIT_MS,
      });

      const downloadLink: string | null = await page.$eval(
        'a[href*="download"]',
        (el: any) => el.getAttribute("href")
      );
      if (!downloadLink) return null;

      return downloadLink.startsWith("http")
        ? downloadLink
        : this.baseUrl + downloadLink;
    } finally {
      signal.removeEventListener("abort", closePage);
      await closePage();
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
      const link = this.baseUrl + mainLink.attr("href")!;
      const md5 = this.extractMd5(link);
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
      ? this.baseUrl + slowDownloadLink.attr("href")!
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

    const format = this.extractFormat(info);
    const md5 = this.extractMd5(url);

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

  private extractMd5(url: string): string {
    const segments = new URL(url).pathname.split("/");
    return segments[segments.length - 1] || "";
  }

  private extractFormat(info: string): string {
    const lowerInfo = info.toLowerCase();
    if (lowerInfo.includes("pdf")) return "pdf";
    if (lowerInfo.includes("cbr")) return "cbr";
    if (lowerInfo.includes("cbz")) return "cbz";
    return "epub";
  }
}
