// @denoboot/permissions/policy.ts

import { roleHasPermission } from "./roles.ts";

export interface PolicyContext {
  user: any;
  action: string;
  object?: any;
}

export function hasPermission(
  user: any,
  permission?: string,
): boolean {
  if (!permission) return true;
  if (user?.isSuperuser) return true;

  for (const role of user.roles ?? []) {
    if (roleHasPermission(role, permission)) {
      return true;
    }
  }

  return false;
}

export function assertPermission(
  user: any,
  permission?: string,
) {
  if (!hasPermission(user, permission)) {
    throw new Error("Permission denied");
  }
}
