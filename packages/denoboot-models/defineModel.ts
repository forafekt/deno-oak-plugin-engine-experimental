// @denoboot/models/defineModel.ts

import type { ModelMeta } from "./model.ts";
import type { ModelSchema } from "./types.ts";

export interface DefineModelOptions {
  tableName?: string;
  timestamps?: boolean;
  permissions?: ModelMeta["permissions"];
}

export function defineModel<T extends ModelSchema>(
  name: string,
  fields: T,
  options: DefineModelOptions = {},
) {
  const meta: ModelMeta = {
    name,
    tableName: options.tableName ?? name.toLowerCase(),
    fields,
    timestamps: options.timestamps ?? true,
    permissions: options.permissions,
  };

  return {
    __type: "denoboot:model" as const,
    meta,

    // Runtime helpers
    getField(name: keyof T) {
      return meta.fields[name as string];
    },

    listFields() {
      return Object.entries(meta.fields);
    },

    listFieldNames() {
      return Object.keys(meta.fields);
    },

    listFieldValues() {
      return Object.values(meta.fields);
    },
  };
}
