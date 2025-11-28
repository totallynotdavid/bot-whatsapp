import type { User } from "./types";
import { Rank } from "./types";
import type { UserStore } from "../stores/user-store";
import type { PermissionStore } from "../stores/permission-store";

export interface StateStats {
  readonly premiumUsersCount: number;
  readonly lastStatsRefresh: Date;
}

export class StateManager {
  private userCache = new Map<string, { user: User; cachedAt: number }>();
  private stats: StateStats = {
    premiumUsersCount: 0,
    lastStatsRefresh: new Date(),
  };

  constructor(
    private readonly userStore: UserStore,
    private readonly permissionStore: PermissionStore,
    private readonly ownerPhone: string
  ) {}

  async getUser(phoneNumber: string): Promise<User> {
    if (phoneNumber === this.ownerPhone) {
      return {
        phoneNumber: this.ownerPhone,
        name: "Owner",
        rank: Rank.OWNER,
      };
    }

    const cached = this.userCache.get(phoneNumber);
    const CACHE_VALID_MS = 60000;

    if (cached && Date.now() - cached.cachedAt < CACHE_VALID_MS) {
      return cached.user;
    }

    const user = await this.userStore.getUser(phoneNumber);

    this.userCache.set(phoneNumber, {
      user,
      cachedAt: Date.now(),
    });

    return user;
  }

  async invalidateUser(phoneNumber: string): Promise<void> {
    this.userCache.delete(phoneNumber);
    await this.permissionStore.invalidateUser(phoneNumber);
  }

  async refreshStats(): Promise<void> {
    const count = await this.userStore.countPremiumUsers();
    this.stats = {
      premiumUsersCount: count,
      lastStatsRefresh: new Date(),
    };
  }

  getStats(): StateStats {
    return this.stats;
  }

  clearCache(): void {
    this.userCache.clear();
  }
}
