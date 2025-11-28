import puppeteer from "puppeteer";
import { retry } from "../lib/retry";
import { executeWithCircuitBreaker } from "../lib/circuit-breaker";
import { withTimeout } from "../lib/timeout";
import { TIMEOUTS } from "../config";
import { log } from "../lib/logger";

export class AnnasDownloadAdapter {
  private static readonly BASE_URL = "https://annas-archive.org";
  private static readonly USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36";

  private browser: any | null = null;

  private async getBrowser(): Promise<any> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
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

  async downloadBook(
    mirrorUrl: string,
    _md5: string,
    _format: string
  ): Promise<Buffer | null> {
    try {
      return await executeWithCircuitBreaker("annas-archive", async () => {
        return retry(async () => {
          return withTimeout(async () => {
            let downloadUrl = mirrorUrl;

            if (mirrorUrl.includes("/slow_download/")) {
              const browser = await this.getBrowser();
              const page = await browser.newPage();
              try {
                await page.goto(mirrorUrl, { waitUntil: "networkidle0" });

                await page.waitForSelector('a[href*="download"]', {
                  timeout: 35000,
                });

                const downloadLink = await page.$eval(
                  'a[href*="download"]',
                  (el: any) => el.getAttribute("href")
                );

                if (!downloadLink) {
                  throw new Error("No download link found");
                }

                downloadUrl = downloadLink.startsWith("http")
                  ? downloadLink
                  : AnnasDownloadAdapter.BASE_URL + downloadLink;
              } finally {
                await page.close();
              }
            }

            const resp = await fetch(downloadUrl, {
              method: "GET",
              headers: {
                "User-Agent": AnnasDownloadAdapter.USER_AGENT,
                Connection: "Keep-Alive",
              },
            });

            if (!resp.ok) {
              throw new Error(`Download failed: ${resp.status}`);
            }

            const buffer = await resp.arrayBuffer();
            return Buffer.from(buffer);
          }, TIMEOUTS.EXTERNAL_API_MS * 2);
        }, "annas-download");
      });
    } catch (error) {
      log("error", "Annas Archive download error", {
        error: error instanceof Error ? error.message : String(error),
        mirrorUrl,
      });
      return null;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
