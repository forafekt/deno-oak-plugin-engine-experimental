// ============================================================================
// core/runtime.ts - Main Runtime class
// ============================================================================

import * as esbuild from "@oakseed/x/esbuild.ts";
import { EventEmitter } from "./events.ts";
import { RuntimeContext, createContext } from "./context.ts";
import { PluginManager } from "./plugin-manager.ts";
import { loadConfig, type ResolvedConfig } from "../config/loader.ts";
import { Builder } from "../build/builder.ts";
import { DevServer } from "../server/dev-server.ts";
import { HMREngineImpl } from "../hmr/engine.ts";
import { Watcher } from "../dev/watcher.ts";
import type { RuntimePlugin } from "./plugin.ts";
import { HMREngine } from "../hmr/engine.ts";
import { DependencyGraph } from "../hmr/graph.ts";

// runtime/core/runtime.ts
export interface RuntimeOptions {
  root: string;
  mode: "development" | "production";
  config?: string;
  hmr?: boolean;
  plugins?: RuntimePlugin[];
}

export interface Runtime {
  // Core lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  
  // Build operations
  build(): Promise<esbuild.BuildResult>;
  rebuild(): Promise<esbuild.BuildResult>;
  
  // State access
  getState(): RuntimeState;
  on(event: string, handler: Function): void;
  
  // Internal
  readonly context: RuntimeContext;
}

// export interface RuntimeContext {
//   options: RuntimeOptions;
//   config: ResolvedConfig;
//   esbuild: esbuild.BuildContext | null;
//   server: DevServer | null;
//   hmr: HMREngine | null;
//   watcher: Deno.FsWatcher | null;
//   plugins: RuntimePlugin[];
//   graph: DependencyGraph;
// }



export interface RuntimeOptions {
  root: string;
  mode: "development" | "production";
  config?: string;
  hmr?: boolean;
  plugins?: RuntimePlugin[];
}

export interface BuildResult {
  outputs: esbuild.OutputFile[];
  metafile: esbuild.Metafile;
  errors: esbuild.Message[];
  warnings: esbuild.Message[];
  duration: number;
}

type RuntimeState = "idle" | "starting" | "running" | "stopping" | "stopped" | "error";

// export interface Runtime {
//   start(): Promise<void>;
//   stop(): Promise<void>;
//   restart(): Promise<void>;
//   build(): Promise<BuildResult>;
//   rebuild(): Promise<BuildResult>;
//   getState(): RuntimeState;
//   on(event: string, handler: (...args: any[]) => void): void;
//   readonly context: RuntimeContext;
// }

class RuntimeImpl extends EventEmitter implements Runtime {
  private state: RuntimeState = "idle";
  public readonly context: RuntimeContext;
  private pluginManager: PluginManager;

  constructor(options: RuntimeOptions) {
    super();
    this.context = createContext(options);
    this.pluginManager = new PluginManager([]);
  }

  async start(): Promise<void> {
    if (this.state !== "idle" && this.state !== "stopped") {
      throw new Error(`Cannot start runtime in state: ${this.state}`);
    }

    this.state = "starting";
    this.emit("starting");

    try {
      // 1. Load and resolve configuration
      this.context.config = await loadConfig(
        this.context.options.root,
        this.context.options.mode,
        this.context.options.config,
      );

      // 2. Initialize plugins
      this.context.plugins = [
        ...this.context.options.plugins ?? [],
        ...this.context.config.plugins,
      ];
      this.pluginManager = new PluginManager(this.context.plugins);
      await this.pluginManager.runHook("configResolved", this.context.config);

      // 3. Create builder
      this.context.builder = new Builder(
        this.context.config,
        this.context.plugins,
      );
      await this.context.builder.initialize();

      // 4. Initial build
      await this.pluginManager.runHook("buildStart");
      const result = await this.context.builder.build();
      await this.pluginManager.runHook("buildEnd", result);

      // 5. Start dev server (dev mode only)
      if (this.context.options.mode === "development" && this.context.options.hmr !== false) {
        this.context.hmr = new HMREngineImpl(
          this.context.builder,
          this.context.config,
          this.pluginManager,
        );
        await this.context.hmr.start();

        this.context.server = new DevServer(
          this.context.builder,
          this.context.hmr,
          this.context.config,
          this.pluginManager,
        );
        await this.context.server.start();

        // 6. Start file watcher
        this.context.watcher = new Watcher(
          this.context.config.root,
          this.context.hmr,
          this.pluginManager,
        );
        await this.context.watcher.start();
      }

      this.state = "running";
      this.emit("ready");
    } catch (err) {
      this.state = "error";
      this.emit("error", err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.state = "stopping";
    this.emit("stopping");

    try {
      // Shutdown in reverse order
      await this.context.watcher?.stop();
      await this.context.server?.stop();
      await this.context.hmr?.stop();
      await this.context.builder?.dispose();

      this.state = "stopped";
      this.emit("stopped");
    } catch (err) {
      this.state = "error";
      this.emit("error", err);
      throw err;
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    this.state = "idle";
    await this.start();
  }

  // @ts-ignore
  async build(): Promise<BuildResult> {
    const startTime = Date.now();
    
    if (!this.context.builder) {
      // Build-only mode (no dev server)
      this.context.config = await loadConfig(
        this.context.options.root,
        this.context.options.mode,
        this.context.options.config,
      );

      this.context.plugins = [
        ...this.context.options.plugins ?? [],
        ...this.context.config.plugins,
      ];
      this.pluginManager = new PluginManager(this.context.plugins);

      this.context.builder = new Builder(
        this.context.config,
        this.context.plugins,
      );
      await this.context.builder.initialize();
    }

    await this.pluginManager.runHook("buildStart");
    const result = await this.context.builder.build();
    await this.pluginManager.runHook("buildEnd", result);

    return {
      ...result,
      duration: Date.now() - startTime,
    };
  }

  // @ts-ignore
  async rebuild(): Promise<BuildResult> {
    if (!this.context.builder) {
      throw new Error("Builder not initialized. Call start() or build() first.");
    }

    const startTime = Date.now();
    const result = await this.context.builder.build();

    return {
      ...result,
      duration: Date.now() - startTime,
    };
  }

  getState(): RuntimeState {
    return this.state;
  }
}

export function createRuntime(options: RuntimeOptions) {
  return new RuntimeImpl(options);
}
