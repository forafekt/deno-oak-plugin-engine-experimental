
export default {
    port: parseInt(Deno.env.get("PORT") || "8000"),
    hostname: Deno.env.get("HOSTNAME") || "localhost",
    env: (Deno.env.get("DENO_ENV") || "development") as "development" | "production",
    logger: { level: (Deno.env.get("LOG_LEVEL") || "info"), useColors: true },
    viewPaths: ["./views"],
    assetPaths: ["./public"],
    pluginPaths: ["./plugins", "../engine/plugins"],
  }