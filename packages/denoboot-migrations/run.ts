// @denoboot/migrations/run.ts

import type { MigrationStep } from "./diff.ts";

export async function runMigration(
  db: any,
  steps: MigrationStep[],
) {
  for (const step of steps) {
    switch (step.type) {
      case "create_table":
        await db.createTable(step.table);
        break;
      case "add_column":
        await db.addColumn(step.table, step.column!, step.to);
        break;
    }
  }
}
