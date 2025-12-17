// core/tenant-manager.ts
/**
 * Tenant Manager - FIXED VERSION
 * Enhanced with better logging and debugging for tenant resolution
 */

import type { Container } from "./container.ts";
import type { Logger } from "../modules/logger.ts";

export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  subdomain?: string;
  config: TenantConfig;
  plugins: string[];
  metadata?: Record<string, unknown>;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TenantConfig {
  database?: DatabaseConfig;
  cache?: CacheConfig;
  theme?: string;
  viewOverrides?: Record<string, string>;
  features?: Record<string, boolean>;
  limits?: TenantLimits;
  [key: string]: unknown;
}

export interface DatabaseConfig {
  type: "mysql" | "sqlite" | "postgres" | "denokv" | "mongodb";
  connection: string | Record<string, unknown>;
  pool?: {
    min?: number;
    max?: number;
  };
}

export interface CacheConfig {
  type: "memory" | "redis" | "denokv";
  connection?: string | Record<string, unknown>;
  ttl?: number;
}

export interface TenantLimits {
  maxUsers?: number;
  maxStorage?: number;
  maxRequests?: number;
  maxWorkers?: number;
}

export interface TenantContext {
  hostname?: string;
  path?: string;
  tenantId?: string;
  headers?: Record<string, string>;
  tenant?: Tenant;
  container?: Container;
  [key: string]: any;
}

export interface TenantResolver {
  resolve(context: TenantContext): Promise<Tenant | null>;
}

export class DefaultTenantResolver implements TenantResolver {
  private tenants = new Map<string, Tenant>();
  private domainMap = new Map<string, string>(); // domain -> tenant id
  private subdomainMap = new Map<string, string>(); // subdomain -> tenant id
  private logger?: Logger;

  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  registerTenant(tenant: Tenant): void {
    this.tenants.set(tenant.id, tenant);
    
    if (tenant.domain) {
      const normalizedDomain = tenant.domain.toLowerCase();
      this.domainMap.set(normalizedDomain, tenant.id);
      this.logger?.debug(`Registered domain mapping: ${normalizedDomain} -> ${tenant.id}`);
    }
    
    if (tenant.subdomain) {
      const normalizedSubdomain = tenant.subdomain.toLowerCase();
      this.subdomainMap.set(normalizedSubdomain, tenant.id);
      this.logger?.debug(`Registered subdomain mapping: ${normalizedSubdomain} -> ${tenant.id}`);
    }
  }

  async resolve(context: TenantContext): Promise<Tenant | null> {
    this.logger?.debug("Attempting to resolve tenant", {
      hostname: context.hostname,
      path: context.path,
      tenantId: context.tenantId,
      hasHeaders: !!context.headers,
    });

    // Try to resolve from context first (pre-resolved tenant)
    if (context.tenant) {
      this.logger?.debug("Tenant already in context", { id: context.tenant.id });
      return context.tenant;
    }

    // Try tenant ID in context (from URL params)
    if (context.tenantId) {
      const tenant = this.tenants.get(context.tenantId);
      if (tenant) {
        this.logger?.debug("Resolved tenant by ID from context", { 
          id: tenant.id, 
          name: tenant.name 
        });
        return tenant;
      }
    }

    // Try hostname resolution
    if (context.hostname) {
      const normalizedHost = context.hostname.toLowerCase();
      
      this.logger?.debug("Checking hostname", { 
        hostname: normalizedHost,
        domainMappings: Array.from(this.domainMap.keys()),
        subdomainMappings: Array.from(this.subdomainMap.keys()),
      });
      
      // Exact domain match
      if (this.domainMap.has(normalizedHost)) {
        const id = this.domainMap.get(normalizedHost)!;
        const tenant = this.tenants.get(id)!;
        this.logger?.debug("Resolved tenant by exact domain", { 
          domain: normalizedHost,
          id: tenant.id, 
          name: tenant.name 
        });
        return tenant;
      }
      
      // Subdomain match (extract first part)
      const subdomain = normalizedHost.split(".")[0];
      if (this.subdomainMap.has(subdomain)) {
        const id = this.subdomainMap.get(subdomain)!;
        const tenant = this.tenants.get(id)!;
        this.logger?.debug("Resolved tenant by subdomain", { 
          subdomain,
          id: tenant.id, 
          name: tenant.name 
        });
        return tenant;
      }
    }

    // Try header-based resolution
    if (context.headers) {
      const tenantHeader = context.headers["x-tenant-id"] || 
                          context.headers["X-Tenant-Id"];
      
      if (tenantHeader && this.tenants.has(tenantHeader)) {
        const tenant = this.tenants.get(tenantHeader)!;
        this.logger?.debug("Resolved tenant by header", { 
          id: tenant.id, 
          name: tenant.name 
        });
        return tenant;
      }
    }

    // Try path-based resolution (/tenant/{id}/...)
    if (context.path) {
      const match = context.path.match(/^\/tenant\/([^\/]+)/);
      if (match) {
        const id = match[1];
        if (this.tenants.has(id)) {
          const tenant = this.tenants.get(id)!;
          this.logger?.debug("Resolved tenant by path", { 
            path: context.path,
            id: tenant.id, 
            name: tenant.name 
          });
          return tenant;
        } else {
          this.logger?.warn("Tenant ID in path not found", { 
            path: context.path,
            tenantId: id,
            availableTenants: Array.from(this.tenants.keys()),
          });
        }
      }
    }

    this.logger?.warn("Could not resolve tenant", {
      hostname: context.hostname,
      path: context.path,
      tenantId: context.tenantId,
      availableTenants: Array.from(this.tenants.keys()),
      registeredDomains: Array.from(this.domainMap.keys()),
      registeredSubdomains: Array.from(this.subdomainMap.keys()),
    });


    // TODO: Implement fallback tenant resolution or return null ????????
    return Array.from(this.tenants.values())[0];
  }

  getTenant(id: string): Tenant | null {
    return this.tenants.get(id) || null;
  }

  listTenants(): Tenant[] {
    return Array.from(this.tenants.values());
  }

  removeTenant(id: string): boolean {
    const tenant = this.tenants.get(id);
    if (!tenant) return false;

    this.tenants.delete(id);
    
    if (tenant.domain) {
      this.domainMap.delete(tenant.domain.toLowerCase());
    }
    
    if (tenant.subdomain) {
      this.subdomainMap.delete(tenant.subdomain.toLowerCase());
    }

    return true;
  }

  clear(): void {
    this.tenants.clear();
    this.domainMap.clear();
    this.subdomainMap.clear();
  }
}

export class TenantManager {
  private resolver: TenantResolver;
  private containers = new Map<string, Container>();
  private logger: Logger;
  private globalContainer: Container;
  private eventEmitter?: any;

  constructor(
    globalContainer: Container,
    logger: Logger,
    resolver?: TenantResolver
  ) {
    this.globalContainer = globalContainer;
    this.logger = logger;
    this.resolver = resolver || new DefaultTenantResolver();
    
    // Set logger on default resolver
    if (this.resolver instanceof DefaultTenantResolver) {
      this.resolver.setLogger(logger);
    }
    
    // Try to get event emitter if available
    try {
      if (globalContainer.has("events")) {
        this.eventEmitter = globalContainer.resolve("events");
      }
    } catch {
      // Events not available
    }
  }

  /**
   * Register a tenant
   */
  registerTenant(tenant: Tenant): void {
    this.logger.debug(`Registering tenant: ${tenant.id}`, {
      name: tenant.name,
      domain: tenant.domain,
      subdomain: tenant.subdomain,
      plugins: tenant.plugins,
    });

    // Validate tenant
    if (!tenant.id || !tenant.name) {
      throw new Error("Tenant must have id and name");
    }

    // Register with resolver
    if (this.resolver instanceof DefaultTenantResolver) {
      this.resolver.registerTenant(tenant);
    }

    // Create tenant-specific container
    const container = this.globalContainer.createChild();
    container.register("tenant", tenant);
    this.containers.set(tenant.id, container);

    this.logger.info(`Tenant registered: ${tenant.id} (${tenant.name})`);

    // Emit event
    if (this.eventEmitter) {
      this.eventEmitter.emit("tenant:registered", { tenant, container });
    }
  }

  /**
   * Register multiple tenants
   */
  registerTenants(tenants: Tenant[]): void {
    this.logger.info(`Registering ${tenants.length} tenants...`);
    for (const tenant of tenants) {
      this.registerTenant(tenant);
    }
  }

  /**
   * Resolve tenant from context
   */
  async resolve(context: TenantContext): Promise<Tenant | null> {
    try {
      const tenant = await this.resolver.resolve(context);
      
      if (tenant && tenant.enabled === false) {
        this.logger.warn(`Tenant ${tenant.id} is disabled`);
        return null;
      }

      if (tenant) {
        this.logger.debug(`Tenant resolved successfully: ${tenant.id}`);
      }

      return tenant;
    } catch (error) {
      this.logger.error("Error resolving tenant", {
        error: error instanceof Error ? error.message : String(error),
        context,
      });
      return this.listTenants()[0];
    }
  }

  /**
   * Get tenant by ID
   */
  getTenant(id: string): Tenant | null {
    if (this.resolver instanceof DefaultTenantResolver) {
      return this.resolver.getTenant(id);
    }
    
    // Fallback: try to get from container
    const container = this.containers.get(id);
    if (container && container.has("tenant")) {
      return container.resolve<Tenant>("tenant");
    }
    
    return null;
  }

  /**
   * Get tenant-specific container
   */
  getContainer(tenantId: string): Container | null {
    return this.containers.get(tenantId) || null;
  }

  /**
   * List all tenants
   */
  listTenants(): Tenant[] {
    if (this.resolver instanceof DefaultTenantResolver) {
      return this.resolver.listTenants();
    }
    
    // Fallback: get from containers
    const tenants: Tenant[] = [];
    for (const container of this.containers.values()) {
      if (container.has("tenant")) {
        tenants.push(container.resolve<Tenant>("tenant"));
      }
    }
    return tenants;
  }

  /**
   * Update tenant configuration
   */
  updateTenant(id: string, updates: Partial<Tenant>): boolean {
    const tenant = this.getTenant(id);
    if (!tenant) return false;

    Object.assign(tenant, updates);
    tenant.updatedAt = new Date().toISOString();

    this.logger.info(`Tenant updated: ${id}`);

    if (this.eventEmitter) {
      this.eventEmitter.emit("tenant:updated", { tenant });
    }

    return true;
  }

  /**
   * Remove tenant
   */
  removeTenant(id: string): boolean {
    const tenant = this.getTenant(id);
    if (!tenant) return false;

    this.containers.delete(id);

    if (this.resolver instanceof DefaultTenantResolver) {
      this.resolver.removeTenant(id);
    }

    this.logger.info(`Tenant removed: ${id}`);

    if (this.eventEmitter) {
      this.eventEmitter.emit("tenant:removed", { tenant });
    }

    return true;
  }

  /**
   * Set custom tenant resolver
   */
  setResolver(resolver: TenantResolver): void {
    this.logger.info("Setting custom tenant resolver");
    this.resolver = resolver;
  }

  /**
   * Get the current resolver
   */
  getResolver(): TenantResolver {
    return this.resolver;
  }

  /**
   * Initialize tenant services
   */
  async initializeTenantServices(): Promise<void> {
    this.logger.info("Initializing tenant services...");

    for (const [tenantId, container] of this.containers.entries()) {
      const tenant = this.getTenant(tenantId);
      if (!tenant) continue;

      this.logger.debug(`Initializing services for tenant: ${tenantId}`);

      try {
        if (this.eventEmitter) {
          await this.eventEmitter.emit("tenant:initialized", { 
            tenant, 
            container 
          });
        }
      } catch (error) {
        this.logger.error(
          `Failed to initialize services for tenant ${tenantId}`,
          {
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }
    }

    this.logger.info("All tenant services initialized");
  }

  /**
   * Check if tenant exists
   */
  hasTenant(id: string): boolean {
    return this.getTenant(id) !== null;
  }

  /**
   * Get tenant count
   */
  getTenantCount(): number {
    return this.listTenants().length;
  }

  /**
   * Get tenants by plugin
   */
  getTenantsByPlugin(pluginName: string): Tenant[] {
    return this.listTenants().filter(t => 
      t.plugins.includes(pluginName)
    );
  }

  /**
   * Enable/disable tenant
   */
  setTenantEnabled(id: string, enabled: boolean): boolean {
    return this.updateTenant(id, { enabled });
  }

  /**
   * Check tenant limits
   */
  checkLimit(
    tenantId: string, 
    limitType: keyof TenantLimits, 
    currentValue: number
  ): boolean {
    const tenant = this.getTenant(tenantId);
    if (!tenant?.config.limits) return true;

    const limit = tenant.config.limits[limitType];
    if (limit === undefined) return true;

    return currentValue < limit;
  }

  /**
   * Print tenant information (debugging)
   */
  printTenants(): void {
    const tenants = this.listTenants();
    
    console.log("\n🏢 Registered Tenants:");
    console.log("═══════════════════════════════════════════════════════");
    
    if (tenants.length === 0) {
      console.log("  No tenants registered");
    } else {
      for (const tenant of tenants) {
        console.log(`\n  ${tenant.id} - ${tenant.name}`);
        if (tenant.domain) {
          console.log(`    Domain: ${tenant.domain}`);
        }
        if (tenant.subdomain) {
          console.log(`    Subdomain: ${tenant.subdomain}`);
        }
        console.log(`    Plugins: ${tenant.plugins.join(", ")}`);
        console.log(`    Enabled: ${tenant.enabled !== false ? "Yes" : "No"}`);
      }
    }
    
    console.log("\n═══════════════════════════════════════════════════════\n");
  }
}