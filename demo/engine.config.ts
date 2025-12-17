import { ConfigLoader } from "@oakseed/engine/mod.ts";
import { DashboardPlugin, MySQLPlugin, SQLitePlugin, DenoKVPlugin, FileSystemRouterPlugin } from "@oakseed/engine/plugins/mod.ts";
import { BlogPlugin } from "./plugins/blog/plugin.ts";
import { AnalyticsPlugin } from "./plugins/analytics/plugin.ts";

// Debug mode
const DEBUG = Deno.env.get("DEBUG") === "true";

// Custom middleware
const corsMiddleware = async (ctx: any, next: any) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE"
  );
 
  await next();

  if (ctx.state.tenant) {
    ctx.response.headers.set("x-tenant-id", ctx.state.tenant.id);
  }
};

// Debug middleware (only in debug mode)
const debugMiddleware = async (ctx: any, next: any) => {
  if (DEBUG) {
    console.log("🔍 Request:", {
      method: ctx.request.method,
      path: ctx.request.url.pathname,
      hostname: ctx.request.url.hostname,
      query: ctx.request.url.search,
    });
  }
  await next();
};

export default ConfigLoader.defineConfig({
  config: {
    port: parseInt(Deno.env.get("PORT") || "8000"),
    hostname: Deno.env.get("HOSTNAME") || "localhost",
    env: (Deno.env.get("DENO_ENV") || "development") as
      | "development"
      | "production",
    logger: { level: Deno.env.get("LOG_LEVEL") || "info", useColors: true },
    viewPaths: ["./views"],
    assetPaths: ["./public"],
    pluginPaths: ["./plugins", "../packages/oakseed-engine/plugins"],
    debug: true,
  },
  plugins: [
    FileSystemRouterPlugin,
    DashboardPlugin,
    MySQLPlugin,
    SQLitePlugin,
    DenoKVPlugin,
    BlogPlugin,
    AnalyticsPlugin,
  ],
  tenantsFile: "./tenants.json",
  middleware: [corsMiddleware, debugMiddleware],
});
