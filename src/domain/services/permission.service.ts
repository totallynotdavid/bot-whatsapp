import type { User } from "../entities/user";
import type { Chat } from "../entities/chat";
import { Rank, canExecute } from "../value-objects/rank";
import type { PhoneNumber } from "../value-objects/phone-number";

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
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
    const cacheKey = `perm:${user.phoneNumber.toString()}:${chat.id}`;

    const cached = await this.cache.get<PermissionCheck>(cacheKey);
    if (cached) return cached;

    const result = this.evaluate(user, chat, requiredRank);

    await this.cache.set(cacheKey, result, this.cacheTTL);
    return result;
  }

  private evaluate(
    user: User,
    chat: Chat,
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

  async invalidateUser(_phone: PhoneNumber): Promise<void> {
    // TODO: We should probably scan and delete keys with pattern
    // For now, cache will naturally expire
  }
}
