import Redis from "ioredis";
import { log } from "../../lib/logging/logger";

const MAX_RETRIES_PER_REQUEST = 3;
const RETRY_DELAY_BASE_MS = 50;
const MAX_RETRY_DELAY_MS = 2000;

export class RedisClient {
  private readonly client: Redis;

  constructor(host: string, port: number) {
    this.client = new Redis({
      host,
      port,
      retryStrategy: (times) => {
        const delay = Math.min(times * RETRY_DELAY_BASE_MS, MAX_RETRY_DELAY_MS);
        return delay;
      },
      maxRetriesPerRequest: MAX_RETRIES_PER_REQUEST,
      lazyConnect: false,
    });

    this.client.on("error", (error) => {
      log("error", "Redis client error", {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    this.client.on("connect", () => {
      log("info", "Redis connected", { host, port });
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      log("warn", "Redis get failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      log("warn", "Redis set failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      log("warn", "Redis delete failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      log("warn", "Redis pattern delete failed", {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
