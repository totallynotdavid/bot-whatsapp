import axios, { type AxiosInstance } from "axios";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

interface BingImageResult {
  images: Array<{ data: Buffer; filename: string }>;
  debugDir: string;
}

export class BingImageGenerator {
  private session: AxiosInstance;
  private imageSession: AxiosInstance;
  private debugDir: string;
  private debugMode: boolean;

  constructor(authCookie: string, debugMode = false) {
    this.debugMode = debugMode;
    this.debugDir = "";

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
  async generate(prompt: string, outputDir: string): Promise<BingImageResult> {
    const timestamp = Date.now();
    const safePrompt = prompt
      .slice(0, 30)
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase();
    this.debugDir = join(outputDir, `debug_${safePrompt}_${timestamp}`);

    if (this.debugMode) {
      await mkdir(this.debugDir, { recursive: true });
      await this.saveDebug("00_input.txt", `Prompt: ${prompt}\nTimestamp: ${timestamp}`);
    }

    // Step 1: Initial request to create the image generation task
    const requestId = await this.initiateGeneration(prompt);

    // Step 2: Poll for results
    const imageLinks = await this.pollForResults(prompt, requestId);

    // Step 3: Download images
    const images = await this.downloadImages(imageLinks);

    return { images, debugDir: this.debugDir };
  }

  private async initiateGeneration(prompt: string): Promise<string> {
    const BING_URL = "https://www.bing.com";
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `${BING_URL}/images/create?q=${encodedPrompt}&rt=3&FORM=GENCRE`;

    console.log(`[Bing] Initiating generation: ${url}`);

    try {
      const response = await this.session.post(url);

      if (this.debugMode) {
        await this.saveDebug("01_initiate_response.json", JSON.stringify({
          status: response.status,
          headers: response.headers,
          redirectUrl: response.request?.res?.responseUrl,
        }, null, 2));
      }

      // Extract request ID from redirect URL
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

      const requestId = match[1];
      console.log(`[Bing] Request ID: ${requestId}`);

      return requestId;
    } catch (error) {
      if (this.debugMode && axios.isAxiosError(error)) {
        await this.saveDebug("01_initiate_error.json", JSON.stringify({
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
        }, null, 2));
      }
      throw error;
    }
  }

  private async pollForResults(prompt: string, requestId: string): Promise<string[]> {
    const BING_URL = "https://www.bing.com";
    const encodedPrompt = encodeURIComponent(prompt);
    const pollingUrl = `${BING_URL}/images/create/async/results/${requestId}?q=${encodedPrompt}`;

    console.log(`[Bing] Polling for results...`);

    const startTime = Date.now();
    const maxWaitMs = 300000; // 5 minutes
    let pollCount = 0;

    while (Date.now() - startTime < maxWaitMs) {
      pollCount++;
      process.stdout.write(".");

      try {
        const response = await this.session.get(pollingUrl);

        if (this.debugMode && pollCount % 5 === 0) {
          await this.saveDebug(`02_poll_${pollCount}.json`, JSON.stringify({
            status: response.status,
            dataLength: response.data?.length || 0,
            dataPreview: typeof response.data === "string" 
              ? response.data.slice(0, 200) 
              : "non-string data",
          }, null, 2));
        }

        // Empty response means still processing
        if (!response.data || response.data === "") {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // Check for errors in response
        if (typeof response.data === "object" && response.data.errorMessage) {
          throw new Error(`Bing error: ${response.data.errorMessage}`);
        }

        // Save full HTML response
        if (this.debugMode) {
          await this.saveDebug("03_final_html.html", response.data);
        }

        console.log(`\n[Bing] Results received after ${pollCount} polls`);

        // Extract image links from HTML
        const imageLinks = this.extractImageLinks(response.data);
        
        if (this.debugMode) {
          await this.saveDebug("04_extracted_links.json", JSON.stringify(imageLinks, null, 2));
        }

        return imageLinks;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status !== 200) {
          throw new Error(`Polling failed with status ${error.response?.status}`);
        }
        throw error;
      }
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

    console.log(`[Bing] Found ${uniqueLinks.length} image links`);
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
    console.log(`[Bing] Downloading ${links.length} images...`);

    const images: Array<{ data: Buffer; filename: string }> = [];
    const errors: string[] = [];

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (!link) continue;
      console.log(`[Bing] Downloading image ${i + 1}/${links.length}`);

      try {
        // Retry logic for ECONNREFUSED errors (Bing CDN can be flaky)
        let lastError: Error | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await this.imageSession.get(link, {
              responseType: "arraybuffer",
            });

            const contentType = response.headers["content-type"] || "";
            
            // Verify it's actually an image
            if (!contentType.startsWith("image/")) {
              console.warn(`[Bing] Skipping non-image (${contentType}): ${link}`);
              if (this.debugMode) {
                await this.saveDebug(`05_skip_${i}.txt`, `Non-image content-type: ${contentType}\nURL: ${link}`);
              }
              continue;
            }

            const buffer = Buffer.from(response.data);
            
            // Verify minimum size (avoid corrupted/placeholder images)
            if (buffer.length < 1024) {
              console.warn(`[Bing] Skipping tiny image (${buffer.length} bytes): ${link}`);
              continue;
            }

            images.push({
              data: buffer,
              filename: `image_${i + 1}.jpg`,
            });

            if (this.debugMode) {
              await this.saveDebug(`06_image_${i + 1}.jpg`, buffer);
            }
            
            // Success, break retry loop
            break;
          } catch (retryError) {
            lastError = retryError instanceof Error ? retryError : new Error(String(retryError));
            if (attempt < 2) {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
              console.log(`[Bing] Retry ${attempt + 1}/2 for ${link}`);
            }
          }
        }
        
        // If all retries failed, log the error
        if (lastError) {
          throw lastError;
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`[Bing] Failed to download ${link}: ${errorMsg}`);
        errors.push(`${link}: ${errorMsg}`);
      }
    }

    if (this.debugMode && errors.length > 0) {
      await this.saveDebug("07_download_errors.json", JSON.stringify(errors, null, 2));
    }

    if (images.length === 0) {
      throw new Error(`Failed to download any images. Errors: ${errors.join(", ")}`);
    }

    console.log(`[Bing] Successfully downloaded ${images.length} images`);
    return images;
  }

  private async saveDebug(filename: string, content: string | Buffer): Promise<void> {
    if (!this.debugMode) return;
    try {
      await writeFile(join(this.debugDir, filename), content);
    } catch (error) {
      console.warn(`[Debug] Failed to save ${filename}:`, error);
    }
  }
}

/**
 * Generate images from a text prompt and save to disk
 */
export async function generateBingImages(
  prompt: string,
  authCookie: string,
  outputDir: string,
  debugMode = false
): Promise<string[]> {
  const generator = new BingImageGenerator(authCookie, debugMode);
  const result = await generator.generate(prompt, outputDir);

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
