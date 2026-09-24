import type { User } from "../../domain/user";
import {
  Rank,
  createOwnerUser,
  createRegularUser,
  calculatePremiumExpiryDate,
} from "../../domain/user";
import type { UserStore } from "../ports/user-store";
import { USER_CACHE_VALID_MS } from "../../config/constants";

export class UserService {
  // Avoids a Postgres round trip for every command from the same sender
  // within USER_CACHE_VALID_MS.
  private userCache = new Map<string, { user: User; cachedAt: number }>();

  constructor(
    private readonly users: UserStore,
    private readonly ownerPhone: string
  ) {}

  async getUser(phoneNumber: string): Promise<User> {
    if (phoneNumber === this.ownerPhone) {
      return createOwnerUser(this.ownerPhone);
    }

    const cached = this.userCache.get(phoneNumber);
    if (cached && Date.now() - cached.cachedAt < USER_CACHE_VALID_MS) {
      return cached.user;
    }

    const userFromDb = await this.users.findByPhoneNumber(phoneNumber);
    const user = userFromDb || createRegularUser(phoneNumber);

    this.userCache.set(phoneNumber, {
      user,
      cachedAt: Date.now(),
    });

    return user;
  }

  async grantPremium(
    phoneNumber: string,
    days: number,
    name?: string
  ): Promise<User> {
    const expiryDate = calculatePremiumExpiryDate(days);

    const premiumUser: User = {
      phoneNumber,
      name: name || "Usuario Premium",
      rank: Rank.PREMIUM,
      premiumExpiresAt: expiryDate,
    };

    await this.users.upsertPremiumUser(premiumUser);
    this.invalidateUser(phoneNumber);

    return premiumUser;
  }

  invalidateUser(phoneNumber: string): void {
    this.userCache.delete(phoneNumber);
  }

  clearCache(): void {
    this.userCache.clear();
  }
}
