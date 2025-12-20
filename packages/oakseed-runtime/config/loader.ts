// ============================================================================
// config/loader.ts - Configuration loading and merging
// ============================================================================
import { join } from "@oakseed/x/std/path.ts";
import { DEFAULT_CONFIG } from "./defaults.ts";
import type { RuntimePlugin } from "../core/plugin.ts";

export interface UserConfig {
  root?: string;
  entry?: string;
  server?: {
    port?: number;
    host?: string;
  };
  build?: {
    outDir?: string;
    splitting?: boolean;
    external?: string[];
    sourcemap?: boolean;
    minify?: boolean;
  };
  hmr?: {
    port?: number;
    host?: string;
  };
  plugins?: RuntimePlugin[];
}

export interface ResolvedConfig {
  root: string;
  mode: "development" | "production";
  configPath: string;
  entry: string;
  server: {
    port: number;
    host: string;
  };
  build: {
    outDir: string;
    splitting: boolean;
    external: string[];
    sourcemap: boolean;
    minify: boolean;
  };
  hmr: {
    port: number;
    host: string;
  };
  plugins: RuntimePlugin[];
}

export async function loadConfig(
  root: string,
  mode: "development" | "production",
  configPath?: string,
): Promise<ResolvedConfig> {
  const resolvedConfigPath = configPath ?? join(root, "runtime.config.ts");
  
  let userConfig: UserConfig = {};
  
  try {
    const mod = await import(`file://${resolvedConfigPath}`);
    userConfig = mod.default ?? {};

    // Apply mode-specific overrides
    if (typeof userConfig === "object" && mode in userConfig) {
      const modeConfig = (userConfig as any)[mode];
      userConfig = deepMerge(userConfig, modeConfig);
    }
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      throw new Error(`Failed to load config: ${(err as Error).message}`);
    }
    // No config file is OK, use defaults
  }
  
  // Merge with defaults
  const resolved: ResolvedConfig = {
    root,
    mode,
    configPath: resolvedConfigPath,
    entry: userConfig.entry ?? DEFAULT_CONFIG.entry,
    server: {
      port: userConfig.server?.port ?? DEFAULT_CONFIG.server.port,
      host: userConfig.server?.host ?? DEFAULT_CONFIG.server.host,
    },
    build: {
      outDir: userConfig.build?.outDir ?? DEFAULT_CONFIG.build.outDir,
      splitting: userConfig.build?.splitting ?? DEFAULT_CONFIG.build.splitting,
      external: userConfig.build?.external ?? DEFAULT_CONFIG.build.external,
      sourcemap: userConfig.build?.sourcemap ?? (mode === "development"),
      minify: userConfig.build?.minify ?? (mode === "production"),
    },
    hmr: {
      port: userConfig.hmr?.port ?? DEFAULT_CONFIG.hmr.port,
      host: userConfig.hmr?.host ?? DEFAULT_CONFIG.hmr.host,
    },
    plugins: userConfig.plugins ?? DEFAULT_CONFIG.plugins,
  };
  
  return resolved;
}

function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = (target as any)[key];
    
    if (sourceValue && typeof sourceValue === "object" && !Array.isArray(sourceValue)) {
      (result as any)[key] = deepMerge(targetValue || {}, sourceValue);
    } else if (sourceValue !== undefined) {
      (result as any)[key] = sourceValue;
    }
  }
  
  return result;
}