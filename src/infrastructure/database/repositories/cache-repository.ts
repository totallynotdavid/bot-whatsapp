import type { RedisClient } from "../redis";
import type { PermissionCheckResult } from "../../../domain/permission";
import { CACHE_TTL_SECONDS } from "../../../config/constants";

export class CacheRepository {
  constructor(private readonly redis: RedisClient) {}

  async getPermission(cacheKey: string): Promise<PermissionCheckResult | null> {
    const fullKey = `permission:${cacheKey}`;
    return await this.redis.get<PermissionCheckResult>(fullKey);
  }

  async setPermission(
    cacheKey: string,
    result: PermissionCheckResult
  ): Promise<void> {
    const fullKey = `permission:${cacheKey}`;
    await this.redis.set(fullKey, result, CACHE_TTL_SECONDS.PERMISSION);
  }

  async invalidateUserPermissions(phoneNumber: string): Promise<void> {
    const pattern = `permission:${phoneNumber}:*`;
    await this.redis.deletePattern(pattern);
  }

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
