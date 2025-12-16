// engine/runtime/sass.ts
/**
 * Sass Compiler
 * Compiles SCSS/Sass files to CSS
 */

import { walkDir, ensureDir } from "../modules/utils.ts";

interface CompileOptions {
  sourceDir?: string;
  outDir?: string;
  minify?: boolean;
  watch?: boolean;
}

export class SassCompiler {
  private options: CompileOptions;

  constructor(options: CompileOptions = {}) {
    this.options = {
      sourceDir: options.sourceDir || "scss",
      outDir: options.outDir || ".out/css",
      minify: options.minify !== false,
      watch: options.watch || false,
    };
  }

  /**
   * Compile a single Sass/SCSS file
   */
  async compileFile(input: string, output: string): Promise<void> {
    console.log(`📝 Compiling: ${input} -> ${output}`);

    try {
      // For now, we'll use a simple approach since Deno doesn't have native Sass
      // In production, you'd want to use https://deno.land/x/denosass or similar
      
      // Read the input file
      const content = await Deno.readTextFile(input);
      
      // Basic processing (in a real implementation, use a Sass library)
      let processed = content;
      
      // Remove comments
      processed = processed.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
      
      // Minify if requested
      if (this.options.minify) {
        processed = processed
          .replace(/\s+/g, " ")
          .replace(/\s*([{}:;,])\s*/g, "$1")
          .trim();
      }

      // Ensure output directory exists
      const outputDir = output.split("/").slice(0, -1).join("/");
      await ensureDir(outputDir);

      // Write output
      await Deno.writeTextFile(output, processed);
      console.log(`✅ Compiled: ${output}`);
    } catch (error) {
      console.error(`❌ Compilation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Compile all Sass files in a directory
   */
  async compileAll(): Promise<void> {
    console.log("🎨 Compiling Sass files...");

    const files: string[] = [];
    for await (const file of walkDir(this.options.sourceDir!, [".scss", ".sass"])) {
      // Skip partials (files starting with _)
      if (!file.split("/").pop()!.startsWith("_")) {
        files.push(file);
      }
    }

    if (files.length === 0) {
      console.log("ℹ️  No Sass files found");
      return;
    }

    for (const file of files) {
      const relativePath = file.replace(this.options.sourceDir!, "").split("/").pop()!;
      const outputPath = `${this.options.outDir}/${relativePath}`.replace(
        /\.(scss|sass)$/,
        ".css"
      );
      await this.compileFile(file, outputPath);
    }

    console.log(`✅ Compiled ${files.length} file(s)`);
  }

  /**
   * Watch and recompile on changes
   */
  async watch(): Promise<void> {
    console.log("👀 Watching Sass files...");

    const watcher = Deno.watchFs(this.options.sourceDir!);

    // Initial compilation
    await this.compileAll();

    for await (const event of watcher) {
      if (event.kind === "modify" || event.kind === "create") {
        for (const path of event.paths) {
          if (path.endsWith(".scss") || path.endsWith(".sass")) {
            if (!path.split("/").pop()!.startsWith("_")) {
              const relativePath = path.replace(this.options.sourceDir!, "").split("/").pop()!;
              const outputPath = `${this.options.outDir}/${relativePath}`.replace(
                /\.(scss|sass)$/,
                ".css"
              );
              await this.compileFile(path, outputPath);
            }
          }
        }
      }
    }
  }
}

// CLI usage
if (import.meta.main) {
  const args = Deno.args;
  const watch = args.includes("--watch");
  const sourceDir = args[0] || "scss";
  const outDir = args[1] || ".out/css";

  const compiler = new SassCompiler({
    sourceDir,
    outDir,
  });

  if (watch) {
    await compiler.watch();
  } else {
    await compiler.compileAll();
  }
}