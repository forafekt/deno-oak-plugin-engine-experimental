// ============================================================================
// build/manifest.ts - Build manifest generation
// ============================================================================
import type * as esbuild from "@denoboot/x/esbuild.ts";

export interface BuildManifest {
  version: string;
  timestamp: number;
  entries: Record<string, ManifestEntry>;
}

export interface ManifestEntry {
  file: string;
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  css?: string[];
}

export class ManifestGenerator {
  generate(metafile: esbuild.Metafile): BuildManifest {
    const entries: Record<string, ManifestEntry> = {};

    for (const [outputPath, output] of Object.entries(metafile.outputs)) {
      const entry: ManifestEntry = {
        file: outputPath,
        isEntry: output.entryPoint !== undefined,
        imports: output.imports
          .filter(imp => imp.kind === "import-statement")
          .map(imp => imp.path),
      };

      if (output.entryPoint) {
        entry.src = output.entryPoint;
      }

      const cssFiles = output.cssBundle ? [output.cssBundle] : [];
      if (cssFiles.length > 0) {
        entry.css = cssFiles;
      }

      entries[outputPath] = entry;
    }

    return {
      version: "1.0",
      timestamp: Date.now(),
      entries,
    };
  }

  async write(manifest: BuildManifest, outDir: string): Promise<void> {
    const manifestPath = `${outDir}/manifest.json`;
    await Deno.writeTextFile(
      manifestPath,
      JSON.stringify(manifest, null, 2),
    );
  }
}
