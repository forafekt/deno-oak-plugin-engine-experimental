// engine/runtime/build.ts
/**
 * Asset Builder
 * Bundles JavaScript files using esbuild
 */

import * as esbuild from "@oakseed/x/esbuild.ts";
import { walkDir, ensureDir } from "../modules/utils.ts";
import { type Logger, ConsoleLogger } from "../modules/logger.ts";
import { dependencyScanner } from "./esbuild/plugins/dependency_scanner.ts";
import { commentsRemover } from "./esbuild/plugins/comments_remover.ts";

async function oakSeedPluginResolver() {
  const plugins = [];
  for await (const file of walkDir("../packages/oakseed-engine/plugins/", [
    ".ts",
  ])) {
    plugins.push(file);
  }
  return plugins;
}

async function localPluginResolver() {
  const plugins = [];
  for await (const file of walkDir("./plugins/", [".ts"])) {
    plugins.push(file);
  }
  return plugins;
}

interface ESBuildOptions extends esbuild.BuildOptions {
  watch?: boolean;
}

export class EsBuildRuntime {
  private options: ESBuildOptions;
  private logger: Logger;

  constructor(options: ESBuildOptions = {}, logger?: Logger) {
    this.options = {
      ...options,
      entryPoints: options.entryPoints || [],
      outdir: options.outdir || "./.out/js",
      minify: options.minify !== false,
      sourcemap: options.sourcemap !== false,
      watch: options.watch || false,
    };
    this.logger = logger || new ConsoleLogger("info", "[EsBuildRuntime]", true);
  }

  /**
   * Build assets
   */
  async build(): Promise<void> {
    this.logger.info("🔨 Building assets...");
    // deno-lint-ignore no-unused-vars
    const { watch, ...options } = this.options;

    // Ensure output directory exists
    await ensureDir(options.outdir!);

    try {
      const result = await esbuild.build({
        ...options,
        bundle: true,
        format: "esm",
        target: "esnext",
        logLevel: "info",
      });

      if (result.errors.length > 0) {
        this.logger.error("❌ Build errors:", result.errors);
      } else {
        this.logger.info("✅ Assets built successfully");
      }
    } catch (error) {
      this.logger.error("❌ Build failed:", (error as Error).message);
      throw error;
    } finally {
      esbuild.stop();
    }
  }

  /**
   * Watch and rebuild on changes
   */
  async watch(): Promise<void> {
    // deno-lint-ignore no-unused-vars
    const { watch, ...options } = this.options;
    const entryPoints = Array.isArray(options.entryPoints)
      ? options.entryPoints
      : Object.values(options.entryPoints || []);

    this.logger.info(
      "👀 Watching " + entryPoints.join("\n").replaceAll('"', "")
    );

    const ctx = await esbuild.context({
      ...options,
      format: "esm",
      target: "esnext",
    });

    await ctx.watch();
  }

  /**
   * Discover and build all JavaScript files in a directory
   */
  static async buildAll(
    sourceDir: string,
    outDir: string,
    options: Partial<ESBuildOptions> = {}
  ): Promise<void> {
    const entryPoints: string[] = [];

    for await (const file of walkDir(sourceDir, [".js", ".ts"])) {
      entryPoints.push(file);
    }

    if (entryPoints.length === 0) {
      console.log(
        `ℹ️  No ${[".js", ".ts"].join(", ")} files found in ${sourceDir}`
      );
      return;
    }

    const builder = new EsBuildRuntime({
      entryPoints,
      outdir: outDir,
      ...options,
    });

    await builder.build();
  }

  static async watchAll(
    sourceDir: string,
    outDir: string,
    options: Partial<ESBuildOptions> = {}
  ): Promise<void> {
    const entryPoints: string[] = [];

    for await (const file of walkDir(sourceDir, [".js", ".ts"])) {
      entryPoints.push(file);
    }

    if (entryPoints.length === 0) {
      console.log(
        `ℹ️  No ${[".js", ".ts"].join(", ")} files found in ${sourceDir}`
      );
      return;
    }

    const builder = new EsBuildRuntime({
      entryPoints,
      outdir: outDir,
      ...options,
    });

    await builder.watch();
  }
}

function argOptionsParser(options: string[]) {
    const parsedOptions = options.reduce((acc, option) => {
    const [key, value] = option.split("=");
    const normalizeValue = (v: string) => {
      if (v === "true") return true;
      if (v === "false") return false;
      if (typeof v === "string") {
        if (!isNaN(Number(v))) return Number(v);
        if (v.includes(",")) {
          return v.split(",").map((item) => item.trim());
        }
        // if dot notation
        if (v.includes(".")) {
          return v.split(".").reduce((acc: any, key: string) => acc[key], {});
        }
        return v;
      }
      return v;
    };

    acc[key as keyof ESBuildOptions] = normalizeValue(value);
    return acc;
  }, {} as ESBuildOptions);

  return parsedOptions;
}

// CLI usage
if (import.meta.main) {
  const args = Deno.args;
  const watch = args.includes("--watch");
  const includePlugins = args.includes("--plugins");

  // const sourceDir = args[0] || "./";
  // const sourceDirPlugins = sourceDir + "/plugins";
  const outDir = args[1] || "./.out/js";
  const pluginOutDir = "./.out/js/plugins";

  // rest of args as EsBuildRuntime options
  const options = args.slice(2).filter((arg) => arg !== "--watch" && arg !== "--plugins");

  const parsedOptions = argOptionsParser(options);

  console.log(parsedOptions);

  const localPlugins = await localPluginResolver();

  const builders = [
    new EsBuildRuntime({
      outdir: outDir,
      watch: watch,
      entryPoints: ["app/main.ts", ...localPlugins],
      sourcemap: true,
      bundle: true,
      external: ["@oakseed/x", "@oakseed/engine", "@oakseed/database-engine", "@oakseed/database-query"],
      plugins: [dependencyScanner, commentsRemover],
      ...parsedOptions,
    }),
  ];

  if (includePlugins) {
    const oakSeedPlugins = await oakSeedPluginResolver();

    builders.push(
      new EsBuildRuntime({
        outdir: pluginOutDir,
        watch: watch,
        entryPoints: oakSeedPlugins,
        sourcemap: true,
        bundle: true,
        external: ["@oakseed/x", "@oakseed/engine", "@oakseed/database-engine", "@oakseed/database-query"],
        plugins: [dependencyScanner, commentsRemover],
        ...parsedOptions,
      })
    );
  }

  if (watch) {
    await Promise.all(builders.map((builder) => builder.watch()));
  } else {
    await Promise.all(builders.map((builder) => builder.build()));
  }
}
