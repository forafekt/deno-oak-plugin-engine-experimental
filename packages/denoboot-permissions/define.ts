// @denoboot/permissions/define.ts

export interface Permission {
  name: string;
  description?: string;
}

const permissions = new Map<string, Permission>();

export function definePermission(
  name: string,
  description?: string,
) {
  permissions.set(name, { name, description });
}

export function getPermission(name: string) {
  return permissions.get(name);
}
