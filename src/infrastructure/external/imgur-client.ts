import { ImgurClient as ImgurSdkClient } from "imgur";
import type {
  ImageHost,
  ImageUpload,
} from "../../application/ports/image-host";
import { retry } from "../../lib/resilience/retry";
import { executeWithCircuitBreaker } from "../../lib/resilience/circuit-breaker";
import { withTimeout } from "../../lib/resilience/timeout";
import { TIMEOUTS } from "../../config/constants";

const CIRCUIT_BREAKER_SERVICE_NAME = "imgur";

export class ImgurClient implements ImageHost {
  private readonly client: ImgurSdkClient | null;

  constructor(clientId?: string) {
    this.client = clientId ? new ImgurSdkClient({ clientId }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async upload(imageUrl: string): Promise<ImageUpload> {
    const client = this.requireClient();

    return executeWithCircuitBreaker(CIRCUIT_BREAKER_SERVICE_NAME, () =>
      retry(
        () =>
          withTimeout(
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
          ),
        "imgur-upload"
      )
    );
  }

  async deleteImage(deleteHash: string): Promise<void> {
    const client = this.requireClient();

    await retry(
      () =>
        withTimeout(
          async () => {
            await client.deleteImage(deleteHash);
          },
          TIMEOUTS.EXTERNAL_API_MS,
          "imgur-delete"
        ),
      "imgur-delete"
    );
  }

  private requireClient(): ImgurSdkClient {
    if (!this.client) throw new Error("Imgur client ID is not configured");
    return this.client;
  }
}
