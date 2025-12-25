// @oakseed/models/model.ts

import type { ModelSchema } from "./types.ts";

export interface ModelMeta {
  name: string;
  tableName: string;
  fields: ModelSchema;
  timestamps: boolean;
  permissions?: {
    create?: string;
    read?: string;
    update?: string;
    delete?: string;
  };
}


