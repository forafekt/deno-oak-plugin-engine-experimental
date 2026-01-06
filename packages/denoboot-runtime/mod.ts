// ============================================================================
// mod.ts - Public API exports

import { UserConfig } from "./config/loader.ts";

// ============================================================================
export { createRuntime, type Runtime, type RuntimeOptions } from "./core/runtime.ts";
export type { RuntimePlugin, HMRContext } from "./core/plugin.ts";
export type { UserConfig, ResolvedConfig, ResolvedConfig as DenoBootRuntimeConfig } from "./config/loader.ts";
export type { BuildResult } from "./build/builder.ts";


export const defineRuntimeConfig = (config: UserConfig) => config;