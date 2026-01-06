// engine/core/plugin-manager.ts
/**
 * Plugin Manager
 * Handles plugin registration, initialization, and lifecycle
 */

// import { Container, Logger, Plugin, PluginConfig } from "./types.ts";
import type { Logger } from "@denoboot/logger/mod.ts";
import type { Container } from "@denoboot/di/mod.ts";
import type { DenoBootRouteDefinition } from "./router.ts";
import type { DenoBootWorkerDefinition } from "./worker_manager.ts";
import type { AnyMiddleware } from "./middleware.ts";
import { fileExists } from "@denoboot/utils/mod.ts";


/**
 * Plugin type
 * client: Client-side plugin
 * server: Server-side plugin
 * client-server: Both client and server-side plugin
 */
export type DenoBootPluginType = 'client' | 'server' | 'client-server';

/**
 * Plugin interface - all plugins must implement this
 */
export interface DenoBootEnginePlugin<TAppMiddleware extends AnyMiddleware = AnyMiddleware, TRouteMiddleware extends AnyMiddleware = AnyMiddleware, TRouteHandler extends TRouteMiddleware = TRouteMiddleware, TContainer extends Container = Container> {
  name: string;
  version: string;
  type: DenoBootPluginType;
  description?: string;
  dependencies?: string[];
  
  // Lifecycle hooks
  init?(container: TContainer, config: DenoBootPluginConfig): Promise<void>;
  boot?(container: TContainer): Promise<void>;
  shutdown?(container: TContainer): Promise<void>;
  
  // Optional features
  routes?: DenoBootRouteDefinition<TRouteMiddleware, TRouteHandler, TContainer>[];
  workers?: DenoBootWorkerDefinition[];
  middleware?: TAppMiddleware[];
  viewPaths?: string[];
  assetPaths?: string[];

  // TODO
  paths?: {
    view: string[];
    assets: string[];
    [key: string]: string[];
  }
}

/**
 * Plugin configuration
 */
export interface DenoBootPluginConfig {
  [key: string]: unknown;
}

interface LoadedPlugin<TAppMiddleware extends AnyMiddleware = AnyMiddleware, TRouteMiddleware extends AnyMiddleware = AnyMiddleware, TRouteHandler extends TRouteMiddleware = TRouteMiddleware, TContainer extends Container = Container> {
  plugin: DenoBootEnginePlugin<TAppMiddleware, TRouteMiddleware, TRouteHandler, TContainer>;
  config: DenoBootPluginConfig;
  initialized: boolean;
  booted: boolean;
}

export class PluginManager<TAppMiddleware extends AnyMiddleware = AnyMiddleware, TRouteMiddleware extends AnyMiddleware = AnyMiddleware, TRouteHandler extends TRouteMiddleware = TRouteMiddleware, TContainer extends Container = Container> {
  private plugins = new Map<string, LoadedPlugin<TAppMiddleware, TRouteMiddleware, TRouteHandler, TContainer>>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Register a plugin
   */
  async register(
    plugin: DenoBootEnginePlugin<TAppMiddleware, TRouteMiddleware, TRouteHandler, TContainer>,
    config: DenoBootPluginConfig = {}
  ): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }

    this.logger.debug(`Registering plugin: ${plugin.name}`);

    // Check dependencies
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(
            `Plugin '${plugin.name}' depends on '${dep}' which is not registered`
          );
        }
      }
    }

    this.plugins.set(plugin.name, {
      plugin,
      config,
      initialized: false,
      booted: false,
    });

    this.logger.info(`Plugin registered: ${plugin.name} v${plugin.version}`);
  }

  /**
   * Register plugin from file path
   */
  async registerFromPath(
    path: string,
    config: DenoBootPluginConfig = {}
  ): Promise<void> {
    const pluginPath = path.endsWith("/plugin.ts")
      ? path
      : `${path}/plugin.ts`;

    if (!(await fileExists(pluginPath))) {
      throw new Error(`Plugin file not found: ${pluginPath}`);
    }

    const module = await import(pluginPath);
    const plugin: DenoBootEnginePlugin<TAppMiddleware, TRouteMiddleware, TRouteHandler, TContainer> = module.default || module.plugin;

    if (!plugin) {
      throw new Error(`No plugin export found in ${pluginPath}`);
    }

    await this.register(plugin, config);
  }

  /**
   * Initialize all registered plugins
   */
  async initialize(container: TContainer) {
    this.logger.info("Initializing plugins...");

    // Sort plugins by dependencies
    const sorted = this.topologicalSort();

    for (const name of sorted) {
      const loaded = this.plugins.get(name)!;
      
      if (loaded.initialized) continue;

      this.logger.debug(`Initializing plugin: ${name}`);

      if (loaded.plugin.init) {
        await loaded.plugin.init(container, loaded.config);
      }

      loaded.initialized = true;
      this.logger.debug(`Plugin initialized: ${name}`);
    }

    this.logger.info("All plugins initialized");
  }

  /**
   * Boot all initialized plugins
   */
  async boot(container: TContainer) {
    this.logger.info("Booting plugins...");

    const sorted = this.topologicalSort();

    for (const name of sorted) {
      const loaded = this.plugins.get(name)!;
      
      if (!loaded.initialized) {
        throw new Error(`Plugin '${name}' must be initialized before booting`);
      }

      if (loaded.booted) continue;

      this.logger.debug(`Booting plugin: ${name}`);

      if (loaded.plugin.boot) {
        await loaded.plugin.boot(container);
      }

      loaded.booted = true;
      this.logger.debug(`Plugin booted: ${name}`);
    }

    this.logger.info("All plugins booted");
  }

  /**
   * Shutdown all plugins
   */
  async shutdown(container: TContainer) {
    this.logger.info("Shutting down plugins...");

    // Reverse order for shutdown
    const sorted = this.topologicalSort().reverse();

    for (const name of sorted) {
      const loaded = this.plugins.get(name)!;

      this.logger.debug(`Shutting down plugin: ${name}`);

      if (loaded.plugin.shutdown) {
        try {
          await loaded.plugin.shutdown(container);
        } catch (error: any) {
          this.logger.error(`Error shutting down plugin ${name}`, {
            error: error.message,
          });
        }
      }
    }

    this.logger.info("All plugins shut down");
  }

  /**
   * Get a plugin by name
   */
  get(name: string): DenoBootEnginePlugin<TAppMiddleware, TRouteMiddleware, TRouteHandler, TContainer> | null {
    const loaded = this.plugins.get(name);
    return loaded ? loaded.plugin : null;
  }

  /**
   * Get plugin config
   */
  getConfig(name: string): DenoBootPluginConfig | null {
    const loaded = this.plugins.get(name);
    return loaded ? loaded.config : null;
  }

  /**
   * Check if plugin is registered
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * List all plugins
   */
  list(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get all plugins
   */
  getAll(): DenoBootEnginePlugin<TAppMiddleware, TRouteMiddleware, TRouteHandler, TContainer>[] {
    return Array.from(this.plugins.values()).map((l) => l.plugin);
  }

  /**
   * Topological sort for dependency resolution
   */
  private topologicalSort(): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected for plugin: ${name}`);
      }

      visiting.add(name);

      const loaded = this.plugins.get(name);
      if (loaded?.plugin.dependencies) {
        for (const dep of loaded.plugin.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(name);
      visited.add(name);
      sorted.push(name);
    };

    for (const name of this.plugins.keys()) {
      visit(name);
    }

    return sorted;
  }
}