// ============================================================================
// config/defaults.ts - Default configuration
// ============================================================================
import type { ResolvedConfig } from "./loader.ts";

export const DEFAULT_CONFIG: Omit<ResolvedConfig, "mode" | "configPath" | "root"> = {
  entry: "src/main.ts",
  server: {
    port: 3000,
    host: "localhost",
  },
  build: {
    outDir: "dist",
    splitting: true,
    external: [],
    sourcemap: true,
    minify: false,
  },
  hmr: {
    port: 24678,
    host: "localhost",
  },
  plugins: [],
};