// ============================================================================
// build/optimizer.ts - Production optimizations
// ============================================================================
import type * as esbuild from "@denoboot/x/esbuild.ts";
import type { ResolvedConfig } from "../config/loader.ts";

export class Optimizer {
  constructor(private config: ResolvedConfig) {}

  getProductionOptions(): Partial<esbuild.BuildOptions> {
    return {
      minify: this.config.build.minify ?? true,
      treeShaking: true,
      
      // Code splitting for better caching
      splitting: this.config.build.splitting ?? true,
      chunkNames: "chunks/[name]-[hash]",
      
      // Source maps in production
      sourcemap: this.config.build.sourcemap ?? false,
      
      // Drop console/debugger in production
      drop: ["console", "debugger"],
      
      // Target modern browsers
      target: ["es2020", "chrome90", "firefox88", "safari14"],
      
      // Legal comments handling
      legalComments: "external",
    };
  }

  async optimizeAssets(outDir: string): Promise<void> {
    // Additional post-build optimizations
    // - Compress assets (gzip, brotli)
    // - Generate preload hints
    // - Optimize images
    
    for await (const entry of Deno.readDir(outDir)) {
      if (entry.isFile && entry.name.endsWith(".js")) {
        const path = `${outDir}/${entry.name}`;
        const content = await Deno.readFile(path);
        
        // Example: Create gzip version
        const compressed = await this.gzip(content);
        await Deno.writeFile(`${path}.gz`, compressed);
      }
    }
  }

  private async gzip(data: Uint8Array): Promise<Uint8Array> {
    // Use Deno's compression API
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    }).pipeThrough(new CompressionStream("gzip"));

    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }
}