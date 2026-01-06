// @denoboot/auth/middleware.ts

import { getSession } from "./session.ts";

export async function authMiddleware(ctx: any, next: any) {
  const token = ctx.cookies.get("session");
  if (token) {
    ctx.user = getSession(token);
  }
  await next();
}
