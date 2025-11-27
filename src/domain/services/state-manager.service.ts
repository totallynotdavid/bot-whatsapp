import { logger } from "../../shared/logger";
import type { User } from "../entities/user";
import type { IUserRepository } from "../repositories/user.repository.interface";
import type { PhoneNumber } from "../value-objects/phone-number";
import type { Rank } from "../value-objects/rank";
import type { ICacheService } from "./permission.service";

export class StateManager {
  private premiumUsersCount = 0;
  private premiumGroupsCount = 0;
  private lastRefresh = new Date();

  constructor(
    private userRepository: IUserRepository,
    private cache: ICacheService,
    private refreshIntervalMs: number
  ) {}

  async initialize(): Promise<void> {
    await this.refreshPremiumCounts();
    this.startPeriodicRefresh();

    logger.info("State manager initialized", {
      premiumUsers: this.premiumUsersCount,
      premiumGroups: this.premiumGroupsCount,
    });
  }

  async getUser(phone: PhoneNumber): Promise<User> {
    const cacheKey = `user:${phone.toString()}`;

    const cached = await this.cache.get<{
      name: string;
      rank: Rank;
      premiumExpiry?: string;
    }>(cacheKey);
    if (cached) {
      return {
        phoneNumber: phone,
        name: cached.name,
        rank: cached.rank,
        premiumExpiry: cached.premiumExpiry
          ? new Date(cached.premiumExpiry)
          : undefined,
      };
    }

    const user = await this.userRepository.getByPhone(phone);
    await this.cache.set(
      cacheKey,
      {
        name: user.name,
        rank: user.rank,
        premiumExpiry: user.premiumExpiry?.toISOString(),
      },
      300
    );

    return user;
  }

  async invalidateUser(phone: PhoneNumber): Promise<void> {
    const cacheKey = `user:${phone.toString()}`;
    await this.cache.delete(cacheKey);
  }

  getPremiumStats(): { users: number; groups: number; lastRefresh: Date } {
    return {
      users: this.premiumUsersCount,
      groups: this.premiumGroupsCount,
      lastRefresh: this.lastRefresh,
    };
  }

  private async refreshPremiumCounts(): Promise<void> {
    try {
      this.premiumUsersCount = 0; // await this.userRepository.countPremiumUsers();
      this.premiumGroupsCount = 0; // await this.groupRepository.countPremiumGroups();
      this.lastRefresh = new Date();
    } catch (error) {
      logger.error("Failed to refresh premium counts", error);
    }
  }

  private startPeriodicRefresh(): void {
    setInterval(() => {
      this.refreshPremiumCounts().catch((err) =>
        logger.error("Periodic refresh failed", err)
      );
    }, this.refreshIntervalMs);
  }
}
