// ============================================================================
// core/context.ts - RuntimeContext
// ============================================================================
import type { Builder } from "../build/builder.ts";
import type { DevServer } from "../server/dev-server.ts";
import type { HMREngine } from "../hmr/engine.ts";
import type { Watcher } from "../dev/watcher.ts";
import type { RuntimePlugin } from "./plugin.ts";
import type { ResolvedConfig } from "../config/loader.ts";
import { RuntimeOptions } from "./runtime.ts";

export interface RuntimeContext {
  options: RuntimeOptions;
  config: ResolvedConfig | null;
  builder: Builder | null;
  server: DevServer | null;
  hmr: HMREngine | null;
  watcher: Watcher | null;
  plugins: RuntimePlugin[];
}

export function createContext(options: RuntimeOptions): RuntimeContext {
  return {
    options,
    config: null,
    builder: null,
    server: null,
    hmr: null,
    watcher: null,
    plugins: [],
  };
}