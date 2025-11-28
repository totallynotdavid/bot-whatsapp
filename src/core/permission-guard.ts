import { Rank, canExecuteCommand } from "./types";
import type { User, PermissionCheckResult } from "./types";
import type { PermissionStore } from "../stores/permission-store";
import { TIMEOUTS } from "../config";

export class PermissionGuard {
  constructor(
    private readonly permissionStore: PermissionStore,
    private readonly ownerPhone: string
  ) {}

  async checkPermission(
    user: User,
    requiredRank: Rank
  ): Promise<PermissionCheckResult> {
    const startTime = Date.now();

    if (user.phoneNumber === this.ownerPhone) {
      return { allowed: true };
    }

    const cacheKey = `${user.phoneNumber}:${requiredRank}`;
    const cached = await this.permissionStore.getCached(cacheKey);

    if (cached !== null) {
      return cached;
    }

    const result = this.evaluatePermission(user, requiredRank);

    await this.permissionStore.cache(cacheKey, result);

    const duration = Date.now() - startTime;

    if (duration > TIMEOUTS.PERMISSION_CHECK_MS) {
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "Permission check exceeded target latency",
          duration,
          target: TIMEOUTS.PERMISSION_CHECK_MS,
          userId: user.phoneNumber,
        })
      );
    }

    return result;
  }

  async invalidateUserPermissions(phoneNumber: string): Promise<void> {
    await this.permissionStore.invalidateUser(phoneNumber);
  }

  private evaluatePermission(
    user: User,
    requiredRank: Rank
  ): PermissionCheckResult {
    if (!canExecuteCommand(user.rank, requiredRank)) {
      return {
        allowed: false,
        denialReason: `Este comando requiere rango ${Rank[requiredRank]} o superior`,
      };
    }

    return { allowed: true };
  }
}
