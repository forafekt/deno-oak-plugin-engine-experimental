// @oakseed/admin/controllers/records.ts

import { getModel } from "../registry.ts";
import { assertPermission } from "@oakseed/permissions";

export async function listRecords(ctx: any) {
  const model = getModel(ctx.params.model);
  assertPermission(ctx.user, model!.permissions?.read);

  const data = await ctx.db.findAll(model!.tableName);

  ctx.response.body = {
    results: data,
  };
}
