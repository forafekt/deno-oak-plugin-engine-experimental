// engine.ts
import type {
  DataAccess,
  DatabaseAdapter,
  EngineConfig,
  JobHandler,
  JobOptions,
  Plugin,
  TenantConfig,
  WorkerAdapter,
} from './types.ts';

export class MultiTenantEngine {
  private databaseAdapter: DatabaseAdapter;
  private workerAdapter: WorkerAdapter;
  private plugins = new Map<string, Plugin>();
  private config: Partial<EngineConfig>;

  constructor(
    databaseAdapter: DatabaseAdapter,
    workerAdapter: WorkerAdapter,
    config: Partial<EngineConfig>,
  ) {
    this.databaseAdapter = databaseAdapter;
    this.workerAdapter = workerAdapter;
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!this.config.database) {
      throw new Error('Database configuration is required');
    }
    // Connect to database
    await this.databaseAdapter.connect(this.config.database);

    // Setup database schema
    await this.databaseAdapter.setupSchema();

    // Start worker if configured
    if (this.config.worker) {
      await this.workerAdapter.start();
    }

    console.log('Multi-tenant engine initialized');
  }

  async shutdown(): Promise<void> {
    // Stop worker
    await this.workerAdapter.stop();

    // Disconnect from database
    await this.databaseAdapter.disconnect();

    // Uninstall plugins
    for (const plugin of this.plugins.values()) {
      if (plugin.uninstall) {
        await plugin.uninstall(this);
      }
    }

    console.log('Multi-tenant engine shutdown');
  }

  // Tenant Management
  async createTenant(
    id: string,
    name: string,
    isolationStrategy?: 'schema' | 'database' | 'prefix',
  ): Promise<TenantConfig> {
    const tenant: TenantConfig = {
      id,
      name,
      isolationStrategy: isolationStrategy ||
        this.config.defaultIsolationStrategy || 'prefix',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.databaseAdapter.createTenant(tenant);
    return tenant;
  }

  async getTenant(id: string): Promise<TenantConfig | null> {
    return await this.databaseAdapter.getTenant(id);
  }

  async listTenants(): Promise<TenantConfig[]> {
    return await this.databaseAdapter.listTenants();
  }

  async updateTenant(
    id: string,
    updates: Partial<TenantConfig>,
  ): Promise<void> {
    await this.databaseAdapter.updateTenant(id, updates);
  }

  async deleteTenant(id: string): Promise<void> {
    await this.databaseAdapter.deleteTenant(id);
  }

  // Data Access
  getDataAccess(tenantId?: string): DataAccess {
    return this.databaseAdapter.getDataAccess(tenantId);
  }

  // Tenant Routing Helper
  async withTenant<T>(
    tenantId: string,
    fn: (dataAccess: DataAccess) => Promise<T>,
  ): Promise<T> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const dataAccess = this.getDataAccess(tenantId);
    return await fn(dataAccess);
  }

  // Background Jobs
  async addJob(
    type: string,
    payload: Record<string, unknown>,
    options?: JobOptions,
  ): Promise<string> {
    return await this.workerAdapter.addJob(type, payload, options);
  }

  registerJobHandler<T>(type: string, handler: JobHandler<T>): void {
    this.workerAdapter.registerHandler(type, handler);
  }

  // Plugin System
  async installPlugin(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already installed`);
    }

    await plugin.install(this);
    this.plugins.set(plugin.name, plugin);
    console.log(`Plugin ${plugin.name} v${plugin.version} installed`);
  }

  async uninstallPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} is not installed`);
    }

    if (plugin.uninstall) {
      await plugin.uninstall(this);
    }

    this.plugins.delete(name);
    console.log(`Plugin ${name} uninstalled`);
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  // Utility Methods
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    database: boolean;
    worker: boolean;
    tenants: number;
    plugins: number;
  }> {
    try {
      const tenants = await this.listTenants();
      const plugins = this.listPlugins();

      // Test database connection
      const dataAccess = this.getDataAccess();
      await dataAccess.query('SELECT 1');

      return {
        status: 'healthy',
        database: true,
        worker: true, // Simplified - you might want to add worker health checks
        tenants: tenants.length,
        plugins: plugins.length,
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        database: false,
        worker: false,
        tenants: 0,
        plugins: 0,
      };
    }
  }

  // Configuration access
  getConfig(): EngineConfig {
    return { ...this.config as EngineConfig };
  }

  // Database adapter access for advanced usage
  getDatabaseAdapter(): DatabaseAdapter {
    return this.databaseAdapter;
  }

  // Worker adapter access for advanced usage
  getWorkerAdapter(): WorkerAdapter {
    return this.workerAdapter;
  }
}
