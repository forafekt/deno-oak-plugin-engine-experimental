// TODO
import { ConsoleLogger } from "@denoboot/logger/mod.ts";

// Debug middleware (only in debug mode)
export function debugMiddleware({ debug = false }) {
  return async function _debugMiddleware(ctx: any, next: any) {
    await next(); // Run the next middleware
    if (debug) {
      const logger = new ConsoleLogger(
        "debug",
        `[${ctx.request.method}] ${ctx.request.url.pathname}`,
        true
      );
    //   logger.debug("x-request-id: ", ctx.request.headers.get("x-request-id"));


      const tenantId = ctx?.tenant?.id ||
          ctx?.tenantId ||
          ctx.state?.tenant?.id ||
          ctx.state?.tenantId ||
          ctx.state?.session?.get("tenant")?.id ||
          ctx.request.headers.get("x-tenant-id")



      console.table({
        method: ctx.request.method,
        ip: ctx.request.ip,
        ips: ctx.request.ips,
        hasBody: ctx.request.hasBody,
        secure: ctx.request.secure,
        href: ctx.request.url.href,
        origin: ctx.request.url.origin,
        protocol: ctx.request.url.protocol,
        username: ctx.request.url.username,
        password: ctx.request.url.password,
        host: ctx.request.url.host,
        hostname: ctx.request.url.hostname,
        port: ctx.request.url.port,
        pathname: ctx.request.url.pathname,
        hash: ctx.request.url.hash,
        search: ctx.request.url.search,
        ...(tenantId && { tenant: tenantId }),
      });
    }

  };
}
