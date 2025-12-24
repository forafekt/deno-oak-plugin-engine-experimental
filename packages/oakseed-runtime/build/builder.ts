// ============================================================================
// build/builder.ts - Complete builder implementation
// ============================================================================
import * as esbuild from "@oakseed/x/esbuild.ts";
import type { ResolvedConfig } from "../config/loader.ts";
import type { RuntimePlugin } from "../core/plugin.ts";
import { Optimizer } from "./optimizer.ts";
import { ManifestGenerator } from "./manifest.ts";

export interface BuildResult {
  outputs: esbuild.OutputFile[];
  metafile: esbuild.Metafile;
  errors: esbuild.Message[];
  warnings: esbuild.Message[];
}

export class Builder {
  private context: esbuild.BuildContext | null = null;
  private outputCache = new Map<string, { contents: Uint8Array; map?: string }>();
  private optimizer: Optimizer;
  private manifestGen: ManifestGenerator;

  constructor(
    private config: ResolvedConfig,
    private plugins: RuntimePlugin[],
  ) {
    this.optimizer = new Optimizer(config);
    this.manifestGen = new ManifestGenerator();
  }

  async initialize(): Promise<void> {
    const esbuildPlugins = this.plugins
      .flatMap(p => p.esbuildPlugins?.() ?? []);

    const baseOptions: esbuild.BuildOptions = {
      entryPoints: [this.config.entry],
      bundle: true,
      format: "esm",
      outdir: this.config.build.outDir,
      logLevel: 'info',
      
      // Dev vs prod
      minify: this.config.build.minify,
      sourcemap: this.config.build.sourcemap,
      splitting: this.config.build.splitting,
      
      // Development optimizations
    //   incremental: this.config.mode === "development",
      write: this.config.mode === "production",
      metafile: true,
      
      // Platform
      platform: "browser",
      target: ["esnext"],
      external: this.config.build.external,
      
      plugins: esbuildPlugins,
    };

    // Apply production optimizations
    const options = this.config.mode === "production"
      ? { ...baseOptions, ...this.optimizer.getProductionOptions() }
      : baseOptions;

    this.context = await esbuild.context(options);
  }

  async build(): Promise<BuildResult> {
    if (!this.context) {
      throw new Error("Builder not initialized. Call initialize() first.");
    }

    const result = await this.context.rebuild();

    // Cache outputs in dev mode
    if (this.config.mode === "development" && result.outputFiles) {
      this.outputCache.clear();
      for (const file of result.outputFiles) {
        this.outputCache.set(file.path, {
          contents: file.contents,
        });
      }
    }

    // Generate manifest in production
    if (this.config.mode === "production" && result.metafile) {
      const manifest = this.manifestGen.generate(result.metafile);
      await this.manifestGen.write(manifest, this.config.build.outDir);
      
      // Run post-build optimizations
      await this.optimizer.optimizeAssets(this.config.build.outDir);
    }

    return {
      outputs: result.outputFiles ?? [],
      metafile: result.metafile!,
      errors: result.errors,
      warnings: result.warnings,
    };
  }

  getOutput(path: string): { contents: Uint8Array; map?: string } | null {
    return this.outputCache.get(path) ?? null;
  }

  // async dispose(): Promise<void> {
  //   await this.context?.dispose();
  //   await esbuild.stop();
  // }

  async dispose(): Promise<void> {
  if (this.context) {
    await this.context.dispose();
    this.context = null;
  }
}
}

let started = false;

export function markEsbuildUsed() {
  started = true;
}

export async function shutdownEsbuild() {
  if (started) {
    esbuild.stop();
    started = false;
  }
}