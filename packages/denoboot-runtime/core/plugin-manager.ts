// ============================================================================
// core/plugin-manager.ts - Plugin orchestration
// ============================================================================
import type { RuntimePlugin } from "./plugin.ts";

type NonNullableFunction<T> = T extends (...args: any[]) => any ? T : never;


export class PluginManager {
  constructor(private plugins: RuntimePlugin[]) {}

  async runHook<K extends keyof RuntimePlugin>(
    name: K,
    ...args: Parameters<NonNullableFunction<RuntimePlugin[K]>>
  ): Promise<void> {
    for (const plugin of this.plugins) {
      const hook = plugin[name];
      if (typeof hook === "function") {
        await (hook as any).apply(plugin, args);
      }
    }
  }

  async runParallelHook<K extends keyof RuntimePlugin>(
    name: K,
    ...args: Parameters<NonNullableFunction<RuntimePlugin[K]>>
  ): Promise<void> {
    await Promise.all(
      this.plugins
        .map(p => p[name])
        .filter(Boolean)
        .map(hook => (hook as any)(...args)),
    );
  }

  getPlugins(): RuntimePlugin[] {
    return [...this.plugins];
  }
}