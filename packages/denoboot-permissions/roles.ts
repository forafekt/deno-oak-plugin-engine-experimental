// @denoboot/permissions/roles.ts

const roles = new Map<string, Set<string>>();

export function defineRole(name: string) {
  roles.set(name, new Set());
}

export function assignPermission(role: string, perm: string) {
  roles.get(role)?.add(perm);
}

export function roleHasPermission(role: string, perm: string) {
  return roles.get(role)?.has(perm);
}
