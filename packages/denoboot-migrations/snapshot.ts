// @denoboot/migrations/snapshot.ts

import { listModels } from "@denoboot/admin";
import type { SchemaSnapshot } from "./schema.ts";

export function generateSnapshot(): SchemaSnapshot {
  const models: SchemaSnapshot["models"] = {};

  for (const model of listModels()) {
    models[model.name] = {
      tableName: model.tableName,
      fields: Object.fromEntries(
        Object.entries(model.fields).map(([k, f]) => [
          k,
          {
            type: (f as any).type,
            required: (f as any).required,
            unique: (f as any).unique,
            default: (f as any).default,
          },
        ]),
      ),
    };
  }

  return {
    version: Date.now(),
    models,
  };
}
