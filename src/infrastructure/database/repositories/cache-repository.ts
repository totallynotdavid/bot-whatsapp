import type { SearchCache } from "../../../application/ports/search-cache";
import type { BookData } from "../../../domain/book";
import type { RedisClient } from "../redis";
import { CACHE_TTL_SECONDS } from "../../../config/constants";

export class CacheRepository implements SearchCache {
  constructor(private readonly redis: RedisClient) {}

  async getSearchResults(userId: string): Promise<BookData[] | null> {
    const key = `search:${userId}`;
    return await this.redis.get<BookData[]>(key);
  }

  async setSearchResults(userId: string, results: BookData[]): Promise<void> {
    const key = `search:${userId}`;
    await this.redis.set(key, results, CACHE_TTL_SECONDS.SEARCH_RESULTS);
  }

  async clearSearchResults(userId: string): Promise<void> {
    const key = `search:${userId}`;
    await this.redis.delete(key);
  }
}
