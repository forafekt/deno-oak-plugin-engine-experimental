// engine/runtime/build.ts
/**
 * Asset Builder
 * Bundles JavaScript files using esbuild
 */

import * as esbuild from "https://deno.land/x/esbuild@v0.19.11/mod.js";
import { walkDir, ensureDir } from "../modules/utils.ts";

interface BuildOptions {
  entryPoints?: string[];
  outdir?: string;
  minify?: boolean;
  sourcemap?: boolean;
  watch?: boolean;
}

export class AssetBuilder {
  private options: BuildOptions;

  constructor(options: BuildOptions = {}) {
    this.options = {
      entryPoints: options.entryPoints || [],
      outdir: options.outdir || "./.out/js",
      minify: options.minify !== false,
      sourcemap: options.sourcemap !== false,
      watch: options.watch || false,
    };
  }

  /**
   * Build assets
   */
  async build(): Promise<void> {
    console.log("🔨 Building assets...");

    // Ensure output directory exists
    await ensureDir(this.options.outdir!);

    try {
      const result = await esbuild.build({
        entryPoints: this.options.entryPoints,
        bundle: true,
        outdir: this.options.outdir,
        minify: this.options.minify,
        sourcemap: this.options.sourcemap,
        format: "esm",
        target: "esnext",
        logLevel: "info",
      });

      if (result.errors.length > 0) {
        console.error("❌ Build errors:", result.errors);
      } else {
        console.log("✅ Assets built successfully");
      }
    } catch (error) {
      console.error("❌ Build failed:", error.message);
      throw error;
    } finally {
      esbuild.stop();
    }
  }

  /**
   * Watch and rebuild on changes
   */
  async watch(): Promise<void> {
    console.log("👀 Watching assets...");

    const ctx = await esbuild.context({
      entryPoints: this.options.entryPoints,
      bundle: true,
      outdir: this.options.outdir,
      minify: this.options.minify,
      sourcemap: this.options.sourcemap,
      format: "esm",
      target: "esnext",
    });

    await ctx.watch();
    console.log("✅ Watching for changes...");
  }

  /**
   * Discover and build all JavaScript files in a directory
   */
  static async buildAll(
    sourceDir: string,
    outDir: string,
    options: Partial<BuildOptions> = {}
  ): Promise<void> {
    const entryPoints: string[] = [];

    for await (const file of walkDir(sourceDir, [".js", ".ts"])) {
      entryPoints.push(file);
    }

    if (entryPoints.length === 0) {
      console.log(`ℹ️  No ${[".js", ".ts"].join(', ')} files found in ${sourceDir}`);
      return;
    }

    const builder = new AssetBuilder({
      entryPoints,
      outdir: outDir,
      ...options,
    });

    await builder.build();
  }

  static async watchAll(
    sourceDir: string,
    outDir: string,
    options: Partial<BuildOptions> = {}
  ): Promise<void> {
    const entryPoints: string[] = [];

    for await (const file of walkDir(sourceDir, [".js", ".ts"])) {
      entryPoints.push(file);
    }

    if (entryPoints.length === 0) {
      console.log(`ℹ️  No ${[".js", ".ts"].join(', ')} files found in ${sourceDir}`);
      return;
    }

    const builder = new AssetBuilder({
      entryPoints,
      outdir: outDir,
      ...options,
    });

    await builder.watch();
  }
}

// CLI usage
if (import.meta.main) {
  const args = Deno.args;
  const watch = args.includes("--watch");
  const sourceDir = args[0] || "./";
  const sourceDirPlugins = sourceDir + "/plugins";
  const outDir = args[1] || "./.out/js";
  const includePlugins = args.includes("--plugins");
  const pluginOutDir = "./.out/js/plugins";

 

  // const builder = new AssetBuilder({
  //   outdir: outDir,
  //   watch: watch,
  //   entryPoints: ['app/main.ts']
  // });
  // const builderPlugins = new AssetBuilder({
  //   outdir: pluginOutDir,
  //   watch: watch,
  // });

  if (watch) {
    await AssetBuilder.watchAll(sourceDir, outDir);
    if (includePlugins) {
      await AssetBuilder.buildAll("../engine/plugins", pluginOutDir);
      await AssetBuilder.watchAll(sourceDirPlugins, pluginOutDir);
    }
  } else {
    await AssetBuilder.buildAll(sourceDir, outDir);
    if (includePlugins) {
      await AssetBuilder.buildAll("../engine/plugins", pluginOutDir);
      await AssetBuilder.watchAll(sourceDirPlugins, pluginOutDir);
    }
  }
}