import type { User } from "../../domain/user";
import {
  createOwnerUser,
  createRegularUser,
  calculatePremiumExpiryDate,
} from "../../domain/user";
import type { UserRepository } from "../../infrastructure/database/repositories/user-repository";
import type { PermissionChecker } from "./permission-checker";
import { USER_CACHE_VALID_MS } from "../../config/constants";

export class UserService {
  private userCache = new Map<string, { user: User; cachedAt: number }>();

  constructor(
    private readonly userRepo: UserRepository,
    private readonly permissionChecker: PermissionChecker,
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

    const userFromDb = await this.userRepo.findByPhoneNumber(phoneNumber);
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
      rank: 20,
      premiumExpiresAt: expiryDate,
    };

    await this.userRepo.upsertPremiumUser(premiumUser);
    await this.invalidateUser(phoneNumber);

    return premiumUser;
  }

  async invalidateUser(phoneNumber: string): Promise<void> {
    this.userCache.delete(phoneNumber);
    await this.permissionChecker.invalidateUserPermissions(phoneNumber);
  }

  clearCache(): void {
    this.userCache.clear();
  }
}
