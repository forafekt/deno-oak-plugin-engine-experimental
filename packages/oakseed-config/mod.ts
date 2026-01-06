// engine/core/config.ts
/**
 * Configuration Loader
 * Loads and merges configuration from various sources
 */

// TODO: This should configure/orchestrate the loading and merging of configuration from multiple sources (FE/BE/CLI/ENV/CONFIG_FILE)

import type { OakSeedConfig, DefineConfig } from "@oakseed/types/mod.ts";
import { deepMerge, fileExists, loadJSON } from "@oakseed/utils/mod.ts";
import type { Tenant } from "@oakseed/engine-core/tenant_manager.ts";


const DEFAULT_CONFIG: OakSeedConfig = {
  port: 8000,
  hostname: "localhost",
  env: "development",
  logger: {
    level: "info",
    useColors: true,
  },
  viewPaths: ["./views"],
  assetPaths: ["./public"],
  pluginPaths: ["./plugins"],
};

export class ConfigLoader {
  /**
   * Load configuration from file and environment
   */
  static async load(configPath?: string): Promise<OakSeedConfig> {
    let config = { ...DEFAULT_CONFIG };

    // Load from file if provided
    if (configPath && (await fileExists(configPath))) {
      const fileConfig = await loadJSON<Partial<OakSeedConfig>>(configPath);
      config = deepMerge(config, fileConfig);
    }

    // Override with environment variables
    const envConfig = this.loadFromEnv();
    config = deepMerge(config, envConfig);

    return config;
  }

  /**
   * Load configuration from environment variables
   */
  private static loadFromEnv(): Partial<OakSeedConfig> {
    const config: Partial<OakSeedConfig> = {};
    const envConfig = this.readEnvFile();

    // if (Deno.env.get("PORT")) {
    //   config.port = parseInt(Deno.env.get("PORT")!);
    // }

    // if (Deno.env.get("HOSTNAME")) {
    //   config.hostname = Deno.env.get("HOSTNAME");
    // }

    // if (Deno.env.get("DENO_ENV")) {
    //   config.env = Deno.env.get("DENO_ENV") as OakSeedConfig["env"];
    // }

    // if (Deno.env.get("LOG_LEVEL")) {
    //     config.logger = { ...config.logger, level: Deno.env.get("LOG_LEVEL") as  LogLevel | undefined || 'info' };
    // }

    return deepMerge(config, envConfig);
  }

  /**
   * Load tenants from file
   */
  static async loadTenants(path: string): Promise<Tenant[]> {
    if (!(await fileExists(path))) {
      return [];
    }

    const data = await loadJSON<{ tenants: Tenant[] }>(path);
    return data.tenants || [];
  }

  /**
   * Validate configuration
   */
  static validate(config: OakSeedConfig): void {
    if (!config.port) {
      throw new Error("Port is required");
    }

    if (config.port < 1 || config.port > 65535) {
      throw new Error(`Invalid port: ${config.port}`);
    }

    const validEnvs = ["development", "production", "test"];
    if (!validEnvs.includes(config.env!)) {
      throw new Error(`Invalid environment: ${config.env}`);
    }

    const validLogLevels = ["debug", "info", "warn", "error"];
    if (!validLogLevels.includes(config.logger?.level!)) {
      throw new Error(`Invalid log level: ${config.logger?.level}`);
    }
  }

  static defineConfig<T extends Record<string, any>>($: DefineConfig<T>) {
    // this.parseDenoJson($);
    this.parseDotEnv($);

    return $;
  }

  private static parseDenoJson<T extends Record<string, any>>(
    $: DefineConfig<T>
  ) {
    try {
      const $denoJson = Deno.readTextFileSync("./deno.json");
      if (typeof $.deno !== "function") {
        $.deno = { ...JSON.parse($denoJson), ...$.deno };
      } else {
        $.deno = (denoJson: Record<string, any>) => ({
          ...JSON.parse($denoJson),
          ...denoJson,
        });
      }
    } catch (error) {
      console.error(error);
    }

    return $;
  }

  private static parseDotEnv<T extends Record<string, any>>(
    $: DefineConfig<T>
  ) {
    if (!$.env) {
      $.env = ".env";
    }

    if (typeof $.env === "string") {
      try {
        $.env = ConfigLoader.readEnvFile($.env, true);
      } catch (error) {
        console.info(error);
        $.env = {};
      }
    } else if (typeof $.env === "object") {
      $.env = { ...$.env };
    } else {
      $.env = {};
    }
    return $;
  }

  static readEnvFile(path = ".env", setEnv = true) {
    const text = Deno.readTextFileSync(path);
    const env: Record<string, string> = {};

    for (const line of text.split("\n")) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      // Remove surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (setEnv) {
        Deno.env.set(key, value);
      }
      env[key] = value;
    }

    return env;
  }
}
