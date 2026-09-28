import type { User, Rank } from "../../domain/user";
import { canExecuteCommand, isOwner } from "../../domain/user";
import type { PermissionCheckResult } from "../../domain/permission";
import {
  createAllowedResult,
  createDeniedResult,
} from "../../domain/permission";
import { formatPermissionDenied } from "../../i18n/es";

export class PermissionChecker {
  constructor(private readonly ownerPhone: string) {}

  checkPermission(user: User, requiredRank: Rank): PermissionCheckResult {
    if (isOwner(user, this.ownerPhone)) {
      return createAllowedResult();
    }

    return this.evaluatePermission(user, requiredRank);
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
