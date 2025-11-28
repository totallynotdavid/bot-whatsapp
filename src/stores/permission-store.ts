import type { PermissionCheckResult } from "../core/types";
import type { RedisAdapter } from "../adapters/redis-adapter";
import { CACHE_TTL } from "../config";

export class PermissionStore {
  constructor(private readonly redis: RedisAdapter) {}

  async getCached(cacheKey: string): Promise<PermissionCheckResult | null> {
    try {
      const fullKey = `permission:${cacheKey}`;
      return await this.redis.get<PermissionCheckResult>(fullKey);
    } catch {
      return null;
    }
  }

  async cache(cacheKey: string, result: PermissionCheckResult): Promise<void> {
    try {
      const fullKey = `permission:${cacheKey}`;
      await this.redis.set(fullKey, result, CACHE_TTL.PERMISSION_SECONDS);
    } catch {
      // Cache failure is not critical
    }
  }

  async invalidateUser(phoneNumber: string): Promise<void> {
    try {
      const pattern = `permission:${phoneNumber}:*`;
      await this.redis.deletePattern(pattern);
    } catch {
      // Invalidation failure is not critical
    }
  }
}
