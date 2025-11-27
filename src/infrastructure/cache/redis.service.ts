import Redis from "ioredis";
import type { ICacheService } from "../../domain/services/permission.service";
import { logger } from "../../shared/logger";

export class RedisService implements ICacheService {
  private client: Redis;

  constructor(host: string, port: number) {
    this.client = new Redis({
      host,
      port,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.client.on("error", (err) => {
      logger.error("Redis error", err);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.warn("Cache get failed", { key, err });
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      logger.warn("Cache set failed", { key, err });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err) {
      logger.warn("Cache delete failed", { key, err });
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
