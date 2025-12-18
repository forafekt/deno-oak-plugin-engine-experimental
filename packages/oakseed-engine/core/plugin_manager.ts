// engine/core/plugin-manager.ts
/**
 * Plugin Manager
 * Handles plugin registration, initialization, and lifecycle
 */

// import { Container, Logger, Plugin, PluginConfig } from "./types.ts";
import { Middleware } from "@oakseed/x/oak.ts";
import { Logger } from "../modules/logger.ts";
import { fileExists } from "../modules/utils.ts";
import { Container } from "./container.ts";
import { RouteDefinition } from "./router.ts";
import { WorkerDefinition } from "./worker_manager.ts";

/**
 * Plugin type
 * client: Client-side plugin
 * server: Server-side plugin
 * client-server: Both client and server-side plugin
 */
export type PluginType = 'client' | 'server' | 'client-server';

/**
 * Plugin interface - all plugins must implement this
 */
export interface Plugin {
  name: string;
  version: string;
  type: PluginType;
  description?: string;
  dependencies?: string[];
  
  // Lifecycle hooks
  init?(container: Container, config: PluginConfig): Promise<void>;
  boot?(container: Container): Promise<void>;
  shutdown?(container: Container): Promise<void>;
  
  // Optional features
  routes?: RouteDefinition[];
  workers?: WorkerDefinition[];
  middleware?: Middleware[];
  viewPaths?: string[];
  assetPaths?: string[];
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
  [key: string]: unknown;
}

interface LoadedPlugin {
  plugin: Plugin;
  config: PluginConfig;
  initialized: boolean;
  booted: boolean;
}

export class PluginManager {
  private plugins = new Map<string, LoadedPlugin>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Register a plugin
   */
  async register(
    plugin: Plugin,
    config: PluginConfig = {}
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
    config: PluginConfig = {}
  ): Promise<void> {
    const pluginPath = path.endsWith("/plugin.ts")
      ? path
      : `${path}/plugin.ts`;

    if (!(await fileExists(pluginPath))) {
      throw new Error(`Plugin file not found: ${pluginPath}`);
    }

    const module = await import(pluginPath);
    const plugin: Plugin = module.default || module.plugin;

    if (!plugin) {
      throw new Error(`No plugin export found in ${pluginPath}`);
    }

    await this.register(plugin, config);
  }

  /**
   * Initialize all registered plugins
   */
  async initialize(container: Container): Promise<void> {
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
  async boot(container: Container): Promise<void> {
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
  async shutdown(container: Container): Promise<void> {
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
  get(name: string): Plugin | null {
    const loaded = this.plugins.get(name);
    return loaded ? loaded.plugin : null;
  }

  /**
   * Get plugin config
   */
  getConfig(name: string): PluginConfig | null {
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
  getAll(): Plugin[] {
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