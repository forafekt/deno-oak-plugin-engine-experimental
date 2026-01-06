// ============================================================================
// dev/reload.ts - Dev loop coordination
// ============================================================================
export interface ReloadStrategy {
  shouldReload(path: string): boolean;
  getReloadType(path: string): "hmr" | "full";
}

export class DefaultReloadStrategy implements ReloadStrategy {
  private fullReloadExtensions = new Set([".html", ".config.ts", ".config.js"]);

  shouldReload(path: string): boolean {
    // Reload for any JS/TS/CSS/HTML changes
    return /\.(js|ts|jsx|tsx|css|html)$/.test(path);
  }

  getReloadType(path: string): "hmr" | "full" {
    const ext = path.substring(path.lastIndexOf("."));
    return this.fullReloadExtensions.has(ext) ? "full" : "hmr";
  }
}