// @denoboot/admin/registry.ts

import type { ModelMeta } from "@denoboot/models";

const models = new Map<string, ModelMeta>();

export function registerModel(meta: ModelMeta) {
  models.set(meta.name.toLowerCase(), meta);
}

export function getModel(name: string) {
  return models.get(name.toLowerCase());
}

export function listModels() {
  return [...models.values()];
}
