// engine/core/config.ts
/**
 * Configuration Loader
 * Loads and merges configuration from various sources
 */

import { CortexConfig } from "./types.ts";
import { deepMerge, fileExists, loadJSON } from "../modules/utils.ts";
import { Tenant } from "./tenant-manager.ts";

const DEFAULT_CONFIG: CortexConfig = {
  port: 8000,
  hostname: "localhost",
  env: "development",
  logger: {
    level: "info",
  },
  viewPaths: ["./views"],
  assetPaths: ["./public"],
  pluginPaths: [],
};

export class ConfigLoader {
  /**
   * Load configuration from file and environment
   */
  static async load(configPath?: string): Promise<CortexConfig> {
    let config = { ...DEFAULT_CONFIG };

    // Load from file if provided
    if (configPath && await fileExists(configPath)) {
      const fileConfig = await loadJSON<Partial<CortexConfig>>(configPath);
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
  private static loadFromEnv(): Partial<CortexConfig> {
    const config: Partial<CortexConfig> = {};

    if (Deno.env.get("PORT")) {
      config.port = parseInt(Deno.env.get("PORT")!);
    }

    if (Deno.env.get("HOSTNAME")) {
      config.hostname = Deno.env.get("HOSTNAME");
    }

    if (Deno.env.get("DENO_ENV")) {
      config.env = Deno.env.get("DENO_ENV") as CortexConfig["env"];
    }

    if (Deno.env.get("LOG_LEVEL")) {
        config.logger = { ...config.logger, level: Deno.env.get("LOG_LEVEL") || 'info' };
    }

    return config;
  }

  /**
   * Load tenants from file
   */
  static async loadTenants(path: string): Promise<Tenant[]> {
    if (!await fileExists(path)) {
      return [];
    }

    const data = await loadJSON<{ tenants: Tenant[] }>(path);
    return data.tenants || [];
  }

  /**
   * Validate configuration
   */
  static validate(config: CortexConfig): void {
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
}