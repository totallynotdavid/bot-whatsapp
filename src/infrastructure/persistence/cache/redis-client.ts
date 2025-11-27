import Redis from "ioredis";
import type { ICacheRepository } from "./cache-repository.interface";
import { logger } from "../../monitoring/logger";

export class RedisClient implements ICacheRepository {
  private readonly client: Redis;

  constructor(host: string, port: number) {
    this.client = new Redis({
      host,
      port,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });

    this.client.on("error", (error) => {
      logger.error("Redis error", error);
    });

    this.client.on("connect", () => {
      logger.info("Redis connected");
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.warn("Cache get failed", { key, error });
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      logger.warn("Cache set failed", { key, error });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.warn("Cache delete failed", { key, error });
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      logger.warn("Cache pattern delete failed", { pattern, error });
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
