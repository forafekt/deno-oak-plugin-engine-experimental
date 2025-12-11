// core/tenant-manager.ts
/**
 * Tenant Manager
 * Manages multi-tenant routing, resolution, and container scoping
 */

import type { Container } from "./container.ts";
import type { Logger } from "../modules/logger.ts";
import { Context as OakContext, State as OakState } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { EventEmitter } from "../modules/events.ts";

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

export interface TenantContext<S extends AS = OakState, AS extends OakState = Record<string, any>> extends OakContext<S, AS> {
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

  registerTenant(tenant: Tenant): void {
    this.tenants.set(tenant.id, tenant);
    
    if (tenant.domain) {
      this.domainMap.set(tenant.domain.toLowerCase(), tenant.id);
    }
    
    if (tenant.subdomain) {
      this.subdomainMap.set(tenant.subdomain.toLowerCase(), tenant.id);
    }
  }

  async resolve(ctx: TenantContext): Promise<Tenant | null> {
    // Try to resolve from context first (pre-resolved tenant)
    if (ctx.tenant) {
      return ctx.tenant;
    }

    // Try tenant ID in context
    const tenantId = ctx.tenantId as string | undefined;
    if (tenantId && this.tenants.has(tenantId)) {
      return this.tenants.get(tenantId)!;
    }

    // Try hostname resolution
    const hostname = ctx.hostname as string | undefined;
    if (hostname) {
      const normalizedHost = hostname.toLowerCase();
      
      // Exact domain match
      if (this.domainMap.has(normalizedHost)) {
        const id = this.domainMap.get(normalizedHost)!;
        return this.tenants.get(id)!;
      }
      
      // Subdomain match
      const subdomain = normalizedHost.split(".")[0];
      if (this.subdomainMap.has(subdomain)) {
        const id = this.subdomainMap.get(subdomain)!;
        return this.tenants.get(id)!;
      }
    }

    // Try header-based resolution
    const tenantHeader = ctx.headers?.["x-tenant-id"] as string | undefined;
    if (tenantHeader && this.tenants.has(tenantHeader)) {
      return this.tenants.get(tenantHeader)!;
    }

    // Try path-based resolution (/tenant/{id}/...)
    const path = ctx.path as string | undefined;
    if (path) {
      const match = path.match(/^\/tenant\/([^\/]+)/);
      if (match) {
        const id = match[1];
        if (this.tenants.has(id)) {
          return this.tenants.get(id)!;
        }
      }
    }

    return null;
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
  private eventEmitter?: EventEmitter;

  constructor(
    globalContainer: Container,
    logger: Logger,
    resolver?: TenantResolver,
    eventEmitter?: EventEmitter,
  ) {
    this.globalContainer = globalContainer;
    this.logger = logger;
    this.resolver = resolver || new DefaultTenantResolver();
    this.eventEmitter = eventEmitter;
    
    // Try to get event emitter if available
    try {
      if (globalContainer.has("events")) {
        this.eventEmitter = globalContainer.resolve("events");
      } else if (eventEmitter) {
        this.eventEmitter = eventEmitter;
      } else {
        this.logger.warn("Event emitter not found");
      }
    } catch {
      // Events not available
    }
  }

  /**
   * Register a tenant
   */
  registerTenant(tenant: Tenant): void {
    this.logger.debug(`Registering tenant: ${tenant.id}`);

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
      
      if (tenant && !tenant.enabled && tenant.enabled !== undefined) {
        this.logger.warn(`Tenant ${tenant.id} is disabled`);
        return null;
      }

      return tenant;
    } catch (error) {
      this.logger.error("Error resolving tenant", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
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

    // Emit event
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

    // Remove container
    this.containers.delete(id);

    // Remove from resolver
    if (this.resolver instanceof DefaultTenantResolver) {
      this.resolver.removeTenant(id);
    }

    this.logger.info(`Tenant removed: ${id}`);

    // Emit event
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
   * Called after plugins are booted
   */
  async initializeTenantServices(): Promise<void> {
    this.logger.info("Initializing tenant services...");

    for (const [tenantId, container] of this.containers.entries()) {
      const tenant = this.getTenant(tenantId);
      if (!tenant) continue;

      this.logger.warn(`Initializing services for tenant: ${tenantId}`);

      try {
        // Emit tenant initialization event
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
}