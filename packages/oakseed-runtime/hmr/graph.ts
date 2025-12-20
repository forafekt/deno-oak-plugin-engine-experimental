// ============================================================================
// hmr/graph.ts - Dependency graph (already provided earlier, included for completeness)
// ============================================================================
import type * as esbuild from "@oakseed/x/esbuild.ts";

export class DependencyGraph {
  private imports = new Map<string, Set<string>>();
  private importers = new Map<string, Set<string>>();
  private acceptances = new Map<string, boolean>();

  update(metafile: esbuild.Metafile): void {
    this.imports.clear();
    this.importers.clear();

    for (const [output, info] of Object.entries(metafile.outputs)) {
      for (const input of Object.keys(info.inputs)) {
        this.addEdge(input, output);
      }
    }
  }

  private addEdge(from: string, to: string): void {
    if (!this.imports.has(from)) {
      this.imports.set(from, new Set());
    }
    this.imports.get(from)!.add(to);

    if (!this.importers.has(to)) {
      this.importers.set(to, new Set());
    }
    this.importers.get(to)!.add(from);
  }

  getAffected(changedPath: string): Set<string> {
    const affected = new Set<string>([changedPath]);
    const queue = [changedPath];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const importers = this.importers.get(current) ?? new Set();

      for (const importer of importers) {
        if (!affected.has(importer)) {
          affected.add(importer);
          queue.push(importer);
        }
      }
    }

    return affected;
  }

  hasAcceptance(path: string): boolean {
    return this.acceptances.get(path) ?? false;
  }

  setAcceptance(path: string, accepted: boolean): void {
    this.acceptances.set(path, accepted);
  }
}
