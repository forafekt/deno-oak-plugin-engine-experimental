// ============================================================================
// core/plugin.ts - Plugin interface
// ============================================================================
import type * as esbuild from "@denoboot/x/esbuild.ts";
import type { ResolvedConfig } from "../config/loader.ts";
import type { BuildResult } from "../build/builder.ts";
import type { DevServer } from "../server/dev-server.ts";
import type { HMREngineImpl } from "../hmr/engine.ts";

export interface HMRContext {
  file: string;
  timestamp: number;
  modules: Set<string>;
  read: () => Promise<string>;
  engine: HMREngineImpl;
}

export interface RuntimePlugin {
  name: string;
  
  // Configuration
  configResolved?(config: ResolvedConfig): void | Promise<void>;
  
  // Build lifecycle
  buildStart?(): void | Promise<void>;
  buildEnd?(result: BuildResult): void | Promise<void>;
  
  // File watching
  onFileChange?(path: string): void | Promise<void>;
  
  // esbuild integration
  esbuildPlugins?(): esbuild.Plugin[];
  
  // HTML transforms
  transformIndexHtml?(html: string): string | Promise<string>;
  
  // Dev server
  configureServer?(server: DevServer): void | Promise<void>;
  
  // HMR
  handleHotUpdate?(ctx: HMRContext): void | Promise<void>;
}