import { ImgurClient as ImgurSdkClient } from "imgur";
import { retry } from "../../lib/resilience/retry";
import { executeWithCircuitBreaker } from "../../lib/resilience/circuit-breaker";
import { withTimeout } from "../../lib/resilience/timeout";
import { TIMEOUTS } from "../../config/constants";
import { log } from "../../lib/logging/logger";

const CIRCUIT_BREAKER_SERVICE_NAME = "imgur";

export interface ImgurUpload {
  readonly link: string;
  readonly deleteHash: string;
}

export class ImgurClient {
  private readonly client: ImgurSdkClient | null;

  constructor(clientId?: string) {
    this.client = clientId ? new ImgurSdkClient({ clientId }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async upload(imageUrl: string): Promise<ImgurUpload | null> {
    if (!this.client) return null;
    const client = this.client;

    try {
      return await executeWithCircuitBreaker(
        CIRCUIT_BREAKER_SERVICE_NAME,
        () => {
          return retry(() => {
            return withTimeout(
              async () => {
                const response = await client.upload({
                  image: imageUrl,
                  type: "url",
                });

                const data = response.data;
                if (
                  !response.success ||
                  typeof data !== "object" ||
                  Array.isArray(data) ||
                  !("link" in data) ||
                  !("deletehash" in data) ||
                  !data.deletehash
                ) {
                  throw new Error(
                    "Imgur upload response missing link/deletehash"
                  );
                }

                return { link: data.link, deleteHash: data.deletehash };
              },
              TIMEOUTS.EXTERNAL_API_MS,
              "imgur-upload"
            );
          }, "imgur-upload");
        }
      );
    } catch (error) {
      log("error", "Imgur upload failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async deleteImage(deleteHash: string): Promise<void> {
    if (!this.client) return;
    const client = this.client;

    try {
      await retry(() => {
        return withTimeout(
          async () => {
            await client.deleteImage(deleteHash);
          },
          TIMEOUTS.EXTERNAL_API_MS,
          "imgur-delete"
        );
      }, "imgur-delete");
    } catch (error) {
      log("warn", "Imgur delete failed", {
        deleteHash,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
