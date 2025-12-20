// ============================================================================
// dev/watcher.ts - File watching
// ============================================================================
import { debounce } from "@oakseed/x/std/async.ts";
import type { HMREngine } from "../hmr/engine.ts";
import type { PluginManager } from "../core/plugin-manager.ts";

export class Watcher {
  private watcher: Deno.FsWatcher | null = null;
  private debouncedInvalidate: (path: string) => void;

  constructor(
    private root: string,
    private hmr: HMREngine,
    private pluginManager: PluginManager,
  ) {
    // Debounce to handle rapid file changes (e.g., save from editor)
    this.debouncedInvalidate = debounce(
      (path: string) => this.handleChange(path),
      50,
    );
  }

  async start(): Promise<void> {
    this.watcher = Deno.watchFs(this.root, { recursive: true });
    this.watchLoop();
  }

  async stop(): Promise<void> {
    this.watcher?.close();
    this.watcher = null;
  }

  private async watchLoop(): Promise<void> {
    if (!this.watcher) return;

    try {
      for await (const event of this.watcher) {
        if (event.kind !== "modify" && event.kind !== "create") continue;

        for (const path of event.paths) {
          // Skip node_modules, .git, etc.
          if (this.shouldIgnore(path)) continue;

          this.debouncedInvalidate(path);
        }
      }
    } catch (err) {
      if ((err as Error).name !== "Interrupted") {
        console.error("Watch error:", err);
      }
    }
  }

  private async handleChange(path: string): Promise<void> {
    console.log(`File changed: ${path}`);

    // 1. Notify plugins
    await this.pluginManager.runHook("onFileChange", path);

    // 2. Trigger HMR
    await this.hmr.invalidate(path);
  }

  private shouldIgnore(path: string): boolean {
    const ignored = [
      "node_modules",
      ".git",
      "dist",
      ".DS_Store",
      "*.log",
    ];

    return ignored.some(pattern => path.includes(pattern));
  }
}