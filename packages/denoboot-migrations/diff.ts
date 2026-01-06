// @denoboot/migrations/diff.ts

import type { SchemaSnapshot } from "./schema.ts";

export interface MigrationStep {
  type:
    | "create_table"
    | "drop_table"
    | "add_column"
    | "remove_column"
    | "alter_column";
  table: string;
  column?: string;
  from?: any;
  to?: any;
}

export function diffSchemas(
  prev: SchemaSnapshot,
  next: SchemaSnapshot,
): MigrationStep[] {
  const steps: MigrationStep[] = [];

  for (const [name, model] of Object.entries(next.models)) {
    if (!prev.models[name]) {
      steps.push({
        type: "create_table",
        table: model.tableName,
      });
      continue;
    }

    const prevFields = prev.models[name].fields;
    const nextFields = model.fields;

    for (const field in nextFields) {
      if (!prevFields[field]) {
        steps.push({
          type: "add_column",
          table: model.tableName,
          column: field,
          to: nextFields[field],
        });
      }
    }
  }

  return steps;
}
