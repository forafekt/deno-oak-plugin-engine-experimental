import { ConfigLoader } from "../engine/mod.ts";
import DashboardPlugin from "../engine/plugins/dashboard/plugin.ts";
import MySQLPlugin from "../engine/plugins/mysql/plugin.ts";
import SQLitePlugin from "../engine/plugins/sqlite/plugin.ts";
import DenoKVPlugin from "../engine/plugins/denokv/plugin.ts";
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
  ctx.response.headers.set("x-tenant-id", "tenant1");
  await next();
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
    pluginPaths: ["./plugins", "../engine/plugins"],
    debug: true,
  },
  plugins: [
    DashboardPlugin,
    MySQLPlugin,
    SQLitePlugin,
    DenoKVPlugin,
    BlogPlugin,
    AnalyticsPlugin,
  ],
  tenantsFile: "./tenants.json",
  middleware: [corsMiddleware, debugMiddleware],
  build: {
    esbuild: {
      sourceDir: "./app",
      entryPoints: ["./app/main.ts"],
      outdir: "./.out/js",
      includePlugins: true,
    },
    sass: {
      sourceDir: "./app/scss",
      outDir: "./.out/css",
      includePlugins: true,
    },
  },
});
