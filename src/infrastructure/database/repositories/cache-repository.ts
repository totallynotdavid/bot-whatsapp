import type { RedisClient } from "../redis";
import { CACHE_TTL_SECONDS } from "../../../config/constants";

export class CacheRepository {
  constructor(private readonly redis: RedisClient) {}

  async getSearchResults(userId: string): Promise<unknown[] | null> {
    const key = `search:${userId}`;
    return await this.redis.get<unknown[]>(key);
  }

  async setSearchResults(userId: string, results: unknown[]): Promise<void> {
    const key = `search:${userId}`;
    await this.redis.set(key, results, CACHE_TTL_SECONDS.SEARCH_RESULTS);
  }

  async clearSearchResults(userId: string): Promise<void> {
    const key = `search:${userId}`;
    await this.redis.delete(key);
  }
}
