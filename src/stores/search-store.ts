import type { BookData } from "../adapters/annas-search-adapter";
import type { RedisAdapter } from "../adapters/redis-adapter";
import { CACHE_TTL } from "../config";

export class SearchStore {
  constructor(private readonly redis: RedisAdapter) {}

  async storePendingSearch(userId: string, books: BookData[]): Promise<void> {
    const key = `search:${userId}`;
    const value = JSON.stringify(books);
    await this.redis.set(key, value, CACHE_TTL.SEARCH_SECONDS);
  }

  async getPendingSearch(userId: string): Promise<BookData[] | null> {
    const key = `search:${userId}`;
    const value = await this.redis.get<string>(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as BookData[];
    } catch {
      return null;
    }
  }

  async clearPendingSearch(userId: string): Promise<void> {
    const key = `search:${userId}`;
    await this.redis.delete(key);
  }
}
