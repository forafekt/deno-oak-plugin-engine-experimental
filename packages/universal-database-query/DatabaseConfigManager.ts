import { DatabaseConfig } from "./types.ts";

// Configuration helper for dynamic loading
export class DatabaseConfigManager {
  static async loadConfig(
    source: "env" | "file" | "object",
    configPath?: string,
  ): Promise<DatabaseConfig> {
    switch (source) {
      case "env":
        return {
          type: (Deno.env.get("DB_TYPE") as any) || "sqlite",
          host: Deno.env.get("DB_HOST"),
          port: Deno.env.get("DB_PORT")
            ? parseInt(Deno.env.get("DB_PORT")!)
            : undefined,
          database: Deno.env.get("DB_NAME") || "app.db",
          username: Deno.env.get("DB_USER"),
          password: Deno.env.get("DB_PASSWORD"),
          filename: Deno.env.get("DB_FILENAME"),
        };
      case "file":
        if (!configPath) throw new Error("Config file path required");
        const configFile = await Deno.readTextFile(configPath);
        return JSON.parse(configFile);
      default:
        throw new Error("Invalid config source");
    }
  }
}
