/**
 * HOW IT WORKS:
 * 1. POST to /images/create with prompt → get redirected with request ID
 * 2. Poll /images/create/async/results/{id} until HTML with images is returned
 * 3. Extract image URLs from HTML src attributes
 * 4. Convert tse*.mm.bing.net URLs to www.bing.com/th/id/ (tse1 CDN is unreachable)
 * 5. Download images with retry logic
 * 
 * CRITICAL: Must convert URLs to www.bing.com host, otherwise tse1.mm.bing.net fails
 */

import axios, { type AxiosInstance } from "axios";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

interface BingImageResult {
  images: Array<{ data: Buffer; filename: string }>;
}

export class BingImageGenerator {
  private session: AxiosInstance;
  private imageSession: AxiosInstance;

  constructor(authCookie: string) {

    this.session = axios.create({
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
        cookie: `_U=${authCookie}`,
        referrer: "https://www.bing.com/images/create/",
      },
      timeout: 200000,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    // Separate session for image downloads with minimal headers
    this.imageSession = axios.create({
      headers: {
        accept: "image/webp,image/apng,image/*,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
        referer: "https://www.bing.com/",
        "sec-fetch-dest": "image",
        "sec-fetch-mode": "no-cors",
        "sec-fetch-site": "same-site",
      },
      timeout: 30000,
      validateStatus: (status) => status >= 200 && status < 400,
    });
  }

  /**
   * Generate images from a text prompt
   */
  async generate(prompt: string): Promise<BingImageResult> {
    const requestId = await this.initiateGeneration(prompt);
    const imageLinks = await this.pollForResults(prompt, requestId);
    const images = await this.downloadImages(imageLinks);
    return { images };
  }

  private async initiateGeneration(prompt: string): Promise<string> {
    const url = `https://www.bing.com/images/create?q=${encodeURIComponent(prompt)}&rt=3&FORM=GENCRE`;
    const response = await this.session.post(url);

    let redirectUrl = response.request?.res?.responseUrl;
    if (!redirectUrl && response.status === 302) {
      redirectUrl = response.headers["location"];
    }

    if (!redirectUrl) {
      throw new Error("No redirect URL found in response");
    }

    const match = redirectUrl.match(/id=([^&]+)/);
    if (!match) {
      throw new Error(`Could not extract request ID from: ${redirectUrl}`);
    }

    return match[1];
  }

  private async pollForResults(prompt: string, requestId: string): Promise<string[]> {
    const pollingUrl = `https://www.bing.com/images/create/async/results/${requestId}?q=${encodeURIComponent(prompt)}`;
    const startTime = Date.now();
    const maxWaitMs = 300000; // 5 minutes

    while (Date.now() - startTime < maxWaitMs) {
      const response = await this.session.get(pollingUrl);

      if (!response.data || response.data === "") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      if (typeof response.data === "object" && response.data.errorMessage) {
        throw new Error(`Bing error: ${response.data.errorMessage}`);
      }

      return this.extractImageLinks(response.data);
    }

    throw new Error("Timeout waiting for results");
  }

  private extractImageLinks(html: string): string[] {
    // Extract from src attributes - this is the method that works reliably
    const srcMatches = html.match(/src="([^"]+)"/g) || [];
    const links = srcMatches
      .map((src) => src.slice(5, -1)) // Remove 'src="' and '"'
      .map((link) => this.decodeHtmlEntities(link))
      .map((link) => {
        // Add ?pid=ImgGn for full size if not present
        if (link.includes('tse') && link.includes('th/id/') && !link.includes('pid=')) {
          const baseUrl = link.split('?')[0];
          return `${baseUrl}?pid=ImgGn`;
        }
        return link;
      })
      .map(link => this.cleanImageUrl(link))
      .map(link => this.convertToAccessibleHost(link))
      .filter((link) => {
        const lower = link.toLowerCase();
        // Filter out non-image resources
        if (lower.endsWith(".js") || lower.includes(".br.js")) return false;
        if (lower.includes("r.bing.com/rp/") && (lower.endsWith(".js") || lower.endsWith(".svg"))) return false;
        // Only keep actual image URLs
        return lower.includes("bing.com/th/id/");
      });

    // Remove duplicates
    const uniqueLinks = Array.from(new Set(links));

    // Check for "bad" images (Bing error placeholders)
    const badImages = [
      "https://r.bing.com/rp/in-2zU3AJUdkgFe7ZKv19yPBHVs.png",
      "https://r.bing.com/rp/TX9QuO3WzcCJz1uaaSwQAz39Kb0.jpg",
    ];

    for (const img of uniqueLinks) {
      if (badImages.includes(img)) {
        throw new Error("Bing flagged this prompt. Try a different prompt.");
      }
    }

    if (uniqueLinks.length === 0) {
      throw new Error("No image links found in response");
    }

    return uniqueLinks;
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private cleanImageUrl(url: string): string {
    // Remove thumbnail parameters but keep pid=ImgGn for full size
    if (!url.includes('?')) return url;
    
    const [base, queryString] = url.split('?');
    if (!base) return url;
    
    const params = new URLSearchParams(queryString);
    
    // Keep only pid parameter for full-size image
    const pid = params.get('pid');
    if (pid) {
      return `${base}?pid=${pid}`;
    }
    
    // If no pid, return just the base URL
    return base;
  }

  private convertToAccessibleHost(url: string): string {
    // Convert tse*.mm.bing.net URLs to www.bing.com/th/id/ which is more reliable
    // e.g., https://tse2.mm.bing.net/th/id/OIG2.xxx?pid=ImgGn
    //    -> https://www.bing.com/th/id/OIG2.xxx?pid=ImgGn
    if (url.includes('tse') && url.includes('.mm.bing.net/th/id/')) {
      const converted = url.replace(/https:\/\/tse\d+\.mm\.bing\.net\/th\/id\//, 'https://www.bing.com/th/id/');
      return converted;
    }
    return url;
  }

  private async downloadImages(
    links: string[]
  ): Promise<Array<{ data: Buffer; filename: string }>> {
    const images: Array<{ data: Buffer; filename: string }> = [];

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (!link) continue;

      // Retry logic for flaky CDN connections
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await this.imageSession.get(link, {
            responseType: "arraybuffer",
          });

          const contentType = response.headers["content-type"] || "";
          if (!contentType.startsWith("image/")) break;

          const buffer = Buffer.from(response.data);
          if (buffer.length < 1024) break;

          images.push({
            data: buffer,
            filename: `image_${i + 1}.jpg`,
          });
          break;
        } catch (error) {
          if (attempt === 2) break;
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    if (images.length === 0) {
      throw new Error("Failed to download any images");
    }

    return images;
  }

}

export async function generateBingImages(
  prompt: string,
  authCookie: string,
  outputDir: string
): Promise<string[]> {
  const generator = new BingImageGenerator(authCookie);
  const result = await generator.generate(prompt);

  // Save images to output directory
  await mkdir(outputDir, { recursive: true });
  const timestamp = Date.now();
  const safePrompt = prompt
    .slice(0, 30)
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toLowerCase();

  const savedPaths: string[] = [];

  for (let i = 0; i < result.images.length; i++) {
    const image = result.images[i];
    if (!image) continue;
    const filename = `${safePrompt}_${timestamp}_${i + 1}.jpg`;
    const filepath = join(outputDir, filename);
    await writeFile(filepath, image.data);
    savedPaths.push(filepath);
  }

  return savedPaths;
}
