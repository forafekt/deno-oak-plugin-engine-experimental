import { ConfigLoader } from "@oakseed/config/mod.ts";
import { DashboardPlugin, MySQLPlugin, SQLitePlugin, DenoKVPlugin, FileSystemRouterPlugin } from "@oakseed/oak-engine-plugins/mod.ts";
import { BlogPlugin } from "./plugins/blog/plugin.ts";
import { AnalyticsPlugin } from "./plugins/analytics/plugin.ts";

const DEBUG = Deno.env.get("DEBUG") === "true";


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
    pluginPaths: ["./plugins"],
    debug: DEBUG,
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
  // middleware: [
  //   // corsMiddleware({ origin: "*" }), 
  //   // debugMiddleware({ debug: DEBUG }),
  // ],
});