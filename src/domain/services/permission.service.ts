import { logger } from "../../shared/logger";
import { PerformanceLogger } from "../../shared/logger/performance-logger";
import type { Chat } from "../entities/chat";
import type { User } from "../entities/user";
import type { PhoneNumber } from "../value-objects/phone-number";
import { canExecute, Rank } from "../value-objects/rank";

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class PermissionService {
  constructor(
    private cache: ICacheService,
    private ownerPhone: PhoneNumber,
    private cacheTTL: number
  ) {}

  async checkCommand(
    user: User,
    chat: Chat,
    requiredRank: Rank
  ): Promise<PermissionCheck> {
    const perf = new PerformanceLogger("permission-check");
    const cacheKey = `perm:${user.phoneNumber.toString()}:${requiredRank}`;

    const cached = await this.cache.get<PermissionCheck>(cacheKey);
    perf.checkpoint("cache-lookup");

    if (cached) {
      perf.finish({ cached: true });
      return cached;
    }

    const result = this.evaluate(user, chat, requiredRank);
    perf.checkpoint("evaluation");

    await this.cache.set(cacheKey, result, this.cacheTTL);
    perf.checkpoint("cache-set");

    perf.finish({ cached: false, allowed: result.allowed });

    return result;
  }

  private evaluate(
    user: User,
    _chat: Chat,
    requiredRank: Rank
  ): PermissionCheck {
    if (user.phoneNumber.equals(this.ownerPhone)) {
      return { allowed: true };
    }

    if (!canExecute(user.rank, requiredRank)) {
      return {
        allowed: false,
        reason: `Este comando requiere rango ${Rank[requiredRank]} o superior`,
      };
    }

    return { allowed: true };
  }

  async invalidateUser(phone: PhoneNumber): Promise<void> {
    const patterns = [`user:${phone.toString()}`, `perm:${phone.toString()}:*`];

    for (const pattern of patterns) {
      try {
        await this.cache.delete(pattern);
      } catch (error) {
        logger.warn("Failed to invalidate cache", { pattern, error });
      }
    }
  }
}
