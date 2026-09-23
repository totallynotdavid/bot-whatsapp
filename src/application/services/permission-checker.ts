import type { User, Rank } from "../../domain/user";
import { canExecuteCommand, isOwner } from "../../domain/user";
import type { PermissionCheckResult } from "../../domain/permission";
import {
  createAllowedResult,
  createDeniedResult,
} from "../../domain/permission";
import type { CacheRepository } from "../../infrastructure/database/repositories/cache-repository";
import { formatPermissionDenied } from "../../i18n/es";
import { TIMEOUTS } from "../../config/constants";
import { log } from "../../lib/logging/logger";

export class PermissionChecker {
  constructor(
    private readonly cacheRepo: CacheRepository,
    private readonly ownerPhone: string
  ) {}

  async checkPermission(
    user: User,
    requiredRank: Rank
  ): Promise<PermissionCheckResult> {
    const startTime = Date.now();

    if (isOwner(user, this.ownerPhone)) {
      return createAllowedResult();
    }

    const cacheKey = `${user.phoneNumber}:${requiredRank}`;
    const cached = await this.cacheRepo.getPermission(cacheKey);

    if (cached !== null) {
      return cached;
    }

    const result = this.evaluatePermission(user, requiredRank);
    await this.cacheRepo.setPermission(cacheKey, result);

    const durationMs = Date.now() - startTime;
    if (durationMs > TIMEOUTS.PERMISSION_CHECK_MS) {
      log("warn", "Permission check exceeded target latency", {
        durationMs,
        targetMs: TIMEOUTS.PERMISSION_CHECK_MS,
        userId: user.phoneNumber,
      });
    }

    return result;
  }

  async invalidateUserPermissions(phoneNumber: string): Promise<void> {
    await this.cacheRepo.invalidateUserPermissions(phoneNumber);
  }

  private evaluatePermission(
    user: User,
    requiredRank: Rank
  ): PermissionCheckResult {
    if (!canExecuteCommand(user.rank, requiredRank)) {
      return createDeniedResult(formatPermissionDenied(requiredRank));
    }

    return createAllowedResult();
  }
}
