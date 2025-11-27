import type { User } from "../../domain/models/user.model";
import type { Chat } from "../../domain/models/chat.model";
import type { PhoneNumber } from "../../domain/value-objects/phone-number.vo";
import { Rank, canExecuteCommand } from "../../domain/value-objects/rank.vo";
import type { ICacheRepository } from "../../infrastructure/persistence/cache/cache-repository.interface";
import type { TimeoutPolicy } from "../../infrastructure/resilience/timeout-policy";
import { PerformanceTracker } from "../../infrastructure/monitoring/performance-tracker";
import { PERFORMANCE, CACHE } from "../../config/constants";

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

export class PermissionChecker {
  constructor(
    private readonly cache: ICacheRepository,
    private readonly ownerPhone: PhoneNumber,
    private readonly timeoutPolicy: TimeoutPolicy
  ) {}

  async checkPermission(
    user: User,
    _chat: Chat,
    requiredRank: Rank
  ): Promise<PermissionCheckResult> {
    const tracker = new PerformanceTracker("permission-check");
    const cacheKey = `perm:${user.phoneNumber.toString()}:${requiredRank}`;

    try {
      const cached = await this.timeoutPolicy.execute(
        () => this.cache.get<PermissionCheckResult>(cacheKey),
        PERFORMANCE.CACHE_LOOKUP_TIMEOUT_MS
      );

      if (cached) {
        tracker.finish({ cached: true, allowed: cached.allowed });
        return cached;
      }
    } catch {
      // Cache timeout or error, continue without cache
    }

    tracker.checkpoint("cache-checked");

    const result = this.evaluatePermission(user, requiredRank);
    tracker.checkpoint("permission-evaluated");

    try {
      await this.cache.set(cacheKey, result, CACHE.PERMISSION_TTL_SECONDS);
    } catch {
      // Cache set failed, but we have the result
    }

    tracker.finish({ cached: false, allowed: result.allowed });

    return result;
  }

  async invalidateUserPermissions(phone: PhoneNumber): Promise<void> {
    const pattern = `perm:${phone.toString()}:*`;
    await this.cache.deletePattern(pattern);
  }

  private evaluatePermission(
    user: User,
    requiredRank: Rank
  ): PermissionCheckResult {
    if (user.phoneNumber.equals(this.ownerPhone)) {
      return { allowed: true };
    }

    if (!canExecuteCommand(user.rank, requiredRank)) {
      return {
        allowed: false,
        reason: `Este comando requiere rango ${Rank[requiredRank]} o superior`,
      };
    }

    return { allowed: true };
  }
}
