// engine/core/kernel.ts
/**
 * OakSeed Kernel
 * Main orchestrator for the engine lifecycle
 */

import {
  Application,
  ListenOptions,
  Middleware,
} from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { Container, createContainer, DIContainer } from "./container.ts";
import { Plugin, PluginConfig, PluginManager } from "./plugin-manager.ts";
import { DefaultTenantResolver, Tenant, TenantManager, TenantResolver } from "./tenant-manager.ts";
import { WorkerManager, WorkerPayload } from "./worker-manager.ts";
import { EtaViewEngine, ViewEngine } from "./view-engine.ts";
import { OakSeedRouter } from "./router.ts";
import { ConfigLoader } from "./config.ts";
import { createLogger, Logger } from "../modules/logger.ts";
import { createEventEmitter, EventEmitter } from "../modules/events.ts";
import { BootstrapOptions, OakSeedConfig } from "./types.ts";
import { bootstrapConfigParser } from "../modules/utils.ts";

export class OakSeedKernel {
  private app: Application;
  private container: Container;
  private logger: Logger;
  private pluginManager: PluginManager;
  private tenantManager: TenantManager;
  private workerManager: WorkerManager;
  private viewEngine: ViewEngine;
  private router: OakSeedRouter;
  private config: OakSeedConfig;
  private middlewares: Middleware[] = [];
  private initialized = false;
  private booted = false;
  private eventEmitter: EventEmitter;

  constructor(config: OakSeedConfig) {
    this.config = config;
    this.app = new Application();
    this.container = createContainer();
    this.logger = createLogger(config.logger);
    this.pluginManager = new PluginManager(this.logger);
    this.workerManager = new WorkerManager(this.logger);
    this.viewEngine = new EtaViewEngine(this.logger, config.viewPaths || []);
    this.eventEmitter = createEventEmitter();
    
    // Initialize tenant manager
    this.tenantManager = new TenantManager(
      this.container,
      this.logger,
      new DefaultTenantResolver(),
    );

    // Initialize router
    this.router = new OakSeedRouter(
      undefined, // TODO: Original Oak Router options
      this.container,
      this.tenantManager,
      this.logger
    );

    // Register core services
    this.registerCoreServices();
  }

  /**
   * Register core services in the container
   */
  private registerCoreServices(): void {
    this.container.register("config", this.config);
    this.container.register("logger", this.logger);
    this.container.register("events", this.eventEmitter);
    this.container.register("plugins", this.pluginManager);
    this.container.register("tenantManager", this.tenantManager);
    this.container.register("workers", this.workerManager);
    this.container.register("views", this.viewEngine);
    this.container.register("router", this.router);
  }

  setContainer(container: Container): void {
    this.container = container;
  }

  /**
   * Register a plugin
   */
  async registerPlugin(
    plugin: Plugin,
    config: PluginConfig = {}
  ): Promise<void> {
    await this.pluginManager.register(plugin, config);
  }

  /**
   * Register a plugin from path
   */
  async registerPluginFromPath(
    path: string,
    config: PluginConfig = {}
  ): Promise<void> {
    await this.pluginManager.registerFromPath(path, config);
  }

  /**
   * Register a tenant
   */
  registerTenant(tenant: Tenant): void {
    this.tenantManager.registerTenant(tenant);
  }

  /**
   * Register multiple tenants
   */
  registerTenants(tenants: Tenant[]): void {
    this.tenantManager.registerTenants(tenants);
  }

  /**
   * Set custom tenant resolver
   */
  setTenantResolver(resolver: TenantResolver): void {
    this.tenantManager.setResolver(resolver);
  }

  /**
   * Add middleware
   */
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Initialize the kernel
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error("Kernel already initialized");
    }

    this.logger.info("Initializing OakSeed kernel...");

    // Initialize plugins
    await this.pluginManager.initialize(this.container);

    // Register plugin routes
    this.registerPluginRoutes();

    // Register plugin workers
    this.registerPluginWorkers();

    // Add plugin view paths
    this.addPluginViewPaths();

    this.initialized = true;
    this.logger.info("Kernel initialized");
  }

  /**
   * Boot the kernel
   */
  async boot(): Promise<void> {
    if (!this.initialized) {
      throw new Error("Kernel must be initialized before booting");
    }

    if (this.booted) {
      throw new Error("Kernel already booted");
    }

    this.logger.info("Booting OakSeed kernel...");

    // Boot plugins
    await this.pluginManager.boot(this.container);

    // Initialize tenant services
    await this.tenantManager.initializeTenantServices();

    // Setup Oak application
    this.setupApplication();

    this.booted = true;
    this.logger.info("Kernel booted");
  }

  /**
   * Register routes from all plugins
   */
  private registerPluginRoutes(): void {
    for (const plugin of this.pluginManager.getAll()) {
      if (plugin.routes) {
        this.logger.debug(`Registering routes for plugin: ${plugin.name}`);
        this.router.registerRoutes(plugin.routes);
      }
    }
  }

  /**
   * Register workers from all plugins
   */
  private registerPluginWorkers(): void {
    for (const plugin of this.pluginManager.getAll()) {
      if (plugin.workers) {
        this.logger.debug(`Registering workers for plugin: ${plugin.name}`);
        this.workerManager.registerWorkers(plugin.name, plugin.workers);
      }
    }
  }

  /**
   * Add view paths from all plugins
   */
  private addPluginViewPaths(): void {
    for (const plugin of this.pluginManager.getAll()) {
      if (plugin.viewPaths) {
        for (const path of plugin.viewPaths) {
          this.viewEngine.addPath(path);
        }
      }
    }
  }

  /**
   * Setup Oak application
   */
  private setupApplication(): void {
    // Error handling
    this.app.use(async (ctx, next) => {
      try {
        await next();
      } catch (error: any) {
        this.logger.error("Request error", {
          error: error.message,
          stack: error.stack,
          url: ctx.request.url.toString(),
        });

        ctx.response.status = error.status || 500;
        ctx.response.body = {
          error: error.message,
          status: error.status || 500,
        };
      }
    });

    // Request logging
    this.app.use(async (ctx, next) => {
      const start = Date.now();
      await next();
      const ms = Date.now() - start;
      this.logger.info(
        `${ctx.request.method} ${ctx.request.url.pathname} - ${ctx.response.status} (${ms}ms)`
      );
    });

    // Apply custom middleware
    for (const middleware of this.middlewares) {
      this.app.use(middleware);
    }

    // Apply plugin middleware
    for (const plugin of this.pluginManager.getAll()) {
      if (plugin.middleware) {
        for (const middleware of plugin.middleware) {
          this.app.use(middleware);
        }
      }
    }

    // Mount router
    this.app.use(this.router.getRouter().routes());
    this.app.use(this.router.getRouter().allowedMethods());

    // 404 handler
    this.app.use((ctx) => {
      ctx.response.status = 404;
      ctx.response.body = { error: "Not found" };
    });
  }

  /**
   * Start the server
   */
  listen(options: ListenOptions = {}) {
    if (!this.booted) {
      throw new Error("Kernel must be booted before listening");
    }

    const { hostname, port } = this.config;

    this.logger.info(`Starting server on ${hostname}:${port}`);
    this.logger.info(`Environment: ${this.config.env}`);
    this.logger.info(`Plugins loaded: ${this.pluginManager.list().length}`);
    this.logger.info(`Tenants registered: ${this.tenantManager.listTenants().length}`);

    return this.app.listen({ hostname, port, ...options });
  }

  /**
   * Shutdown the kernel
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down OakSeed kernel...");

    await this.pluginManager.shutdown(this.container);
    
    this.logger.info("Kernel shut down");
  }

  /**
   * Get container
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Get tenant container
   */
  getTenantContainer(tenantId: string): Container | null {
    return this.tenantManager.getContainer(tenantId);
  }

  /**
   * Dispatch a worker
   */
  async dispatchWorker(
    plugin: string,
    worker: string,
    payload: WorkerPayload
  ): Promise<string> {
    return await this.workerManager.dispatch(
      plugin,
      worker,
      payload,
      this.container
    );
  }

  /**
   * Render a view
   */
  async renderView(
    view: string,
    data: Record<string, unknown> = {}
  ): Promise<string> {
    return await this.viewEngine.render(view, data);
  }

  /**
   * Get Oak application (for advanced usage)
   */
  getApplication(): Application {
    return this.app;
  }

  /**
   * Get configuration
   */
  getConfig(): OakSeedConfig {
    return this.config;
  }

  isDebug(): boolean {
    return this.config.debug || false;
  }
}

/**
 * Bootstrap the OakSeed Engine
 * 
 * @param options - Configuration options or path to config file
 * @default options = 'engine.config.ts'
 * @returns {Promise<OakSeedKernel>}
 */
export async function bootstrap(
  /**
   * Configuration options or path to config file
   * 
   * @default 'engine.config.ts'
   */
  options: BootstrapOptions | string = 'engine.config.ts'
): Promise<OakSeedKernel> {

const cfg = await bootstrapConfigParser(options);

const logger = createLogger(cfg.config?.logger);
  
logger.info("Bootstrapping OakSeed Engine...");

  // Validate configuration
  ConfigLoader.validate(cfg.config);

  // Create kernel
  const kernel = new OakSeedKernel(cfg.config);

  // Use custom container if provided
  if (cfg.container) {
    // Transfer services to custom container
    // (This is advanced usage)
    // kernel.setContainer(options.container);
  }

  // Set custom tenant resolver
  if (cfg.tenantResolver) {
    kernel.setTenantResolver(cfg.tenantResolver);
  }

  // Register plugins
  if (cfg.plugins) {
    for (const plugin of cfg.plugins) {
      await kernel.registerPlugin(plugin);
    }
  }

  // Load tenants from file
  if (cfg.tenantsFile) {
    const tenants = await ConfigLoader.loadTenants(cfg.tenantsFile);
    kernel.registerTenants(tenants);
  }

  // Register tenants
  if (cfg.tenants) {
    kernel.registerTenants(cfg.tenants);
  }

  // Apply middleware
  if (cfg.middleware) {
    for (const middleware of cfg.middleware) {
      kernel.use(middleware);
    }
  }

  // Initialize and boot
  await kernel.initialize();
  await kernel.boot();

  logger.info("OakSeed Engine ready");

  return kernel;
}