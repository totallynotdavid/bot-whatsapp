export interface PermissionCheckResult {
  readonly allowed: boolean;
  readonly denialReason?: string;
}

export function createAllowedResult(): PermissionCheckResult {
  return { allowed: true };
}

export function createDeniedResult(reason: string): PermissionCheckResult {
  return { allowed: false, denialReason: reason };
}
