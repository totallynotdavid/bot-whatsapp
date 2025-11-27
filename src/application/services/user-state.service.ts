import type { User } from "../../domain/models/user.model";
import type { IUserRepository } from "../../domain/repositories/user-repository.interface";
import type { PhoneNumber } from "../../domain/value-objects/phone-number.vo";
import type { ICacheRepository } from "../../infrastructure/persistence/cache/cache-repository.interface";
import { logger } from "../../infrastructure/monitoring/logger";
import { CACHE, SYNC } from "../../config/constants";

export class UserStateService {
  private premiumUsersCount = 0;
  private premiumGroupsCount = 0;
  private lastStatsRefresh = new Date();

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly cache: ICacheRepository
  ) {}

  async initialize(): Promise<void> {
    await this.refreshPremiumStats();
    this.startPeriodicStatsRefresh();

    logger.info("UserStateService initialized", {
      premiumUsers: this.premiumUsersCount,
      premiumGroups: this.premiumGroupsCount,
    });
  }

  async getUser(phone: PhoneNumber): Promise<User> {
    const cacheKey = `user:${phone.toString()}`;

    try {
      const cached = await this.cache.get<User>(cacheKey);
      if (cached) {
        return this.deserializeUser(cached, phone);
      }
    } catch {
      // Cache miss or error, fetch from repository
    }

    const user = await this.userRepository.findByPhone(phone);

    try {
      await this.cache.set(
        cacheKey,
        this.serializeUser(user),
        CACHE.USER_TTL_SECONDS
      );
    } catch {
      // Cache set failed, but we have the user
    }

    return user;
  }

  async invalidateUser(phone: PhoneNumber): Promise<void> {
    const cacheKey = `user:${phone.toString()}`;
    await this.cache.delete(cacheKey);
  }

  getOwnerPhone(): PhoneNumber {
    return this.userRepository.getOwnerPhone();
  }

  getPremiumStats(): {
    users: number;
    groups: number;
    lastRefresh: Date;
  } {
    return {
      users: this.premiumUsersCount,
      groups: this.premiumGroupsCount,
      lastRefresh: this.lastStatsRefresh,
    };
  }

  private async refreshPremiumStats(): Promise<void> {
    try {
      this.premiumUsersCount = await this.userRepository.countPremiumUsers();
      this.lastStatsRefresh = new Date();
    } catch (error) {
      logger.error("Failed to refresh premium stats", error);
    }
  }

  private startPeriodicStatsRefresh(): void {
    setInterval(() => {
      this.refreshPremiumStats().catch((error) =>
        logger.error("Periodic stats refresh failed", error)
      );
    }, SYNC.PREMIUM_STATS_REFRESH_MS);
  }

  private serializeUser(user: User): any {
    return {
      name: user.name,
      rank: user.rank,
      premiumExpiry: user.premiumExpiry?.toISOString(),
    };
  }

  private deserializeUser(cached: any, phone: PhoneNumber): User {
    return {
      phoneNumber: phone,
      name: cached.name,
      rank: cached.rank,
      premiumExpiry: cached.premiumExpiry
        ? new Date(cached.premiumExpiry)
        : undefined,
    };
  }
}
