// @denoboot/admin/config.ts

export interface AdminConfig {
  listDisplay?: string[];
  search?: string[];
  filters?: string[];
}

const adminConfigs = new Map<string, AdminConfig>();

export function registerAdmin(
  model: any,
  config: AdminConfig,
) {
  adminConfigs.set(model.meta.name, config);
}

export function getAdminConfig(modelName: string) {
  return adminConfigs.get(modelName);
}
