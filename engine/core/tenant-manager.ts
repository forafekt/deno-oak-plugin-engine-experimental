// engine/core/tenant-manager.ts
/** TenantManager
 *
 * Responsibilities:
 *  - register and manage tenant metadata/configuration
 *  - lookup tenant by id or hostname
 *  - lifecycle cleanup
 *
 * The tenant shape is intentionally permissive because the project's
 * core/types.ts holds canonical interfaces; plugins use runtime fields.
 */

import { Logger } from "../modules/logger.ts";
import { Container, Tenant, TenantResolver } from "./types.ts";

export interface TenantConfig {
  id: string;
  name?: string;
  hostnames?: string[]; // e.g. ["example.com", "api.example.com"]
  dataDir?: string;
  kvPath?: string; // optional path for per-tenant Deno KV
  metadata?: Record<string, any>;
  // other runtime handles may be attached by the engine (kv instance, etc.)
  [key: string]: any;
}

export class TenantManager {
  private tenants = new Map<string, TenantConfig>();
  private container: Container;
  private logger: Logger;

  constructor(container: Container, logger: Logger) {
    this.tenants = new Map<string, TenantConfig>();
    this.container = container;
    this.logger = logger;
  }

  async initializeTenantServices() {
    // Initialize tenant services

  }

  async registerTenant(cfg: TenantConfig): Promise<void> {
    if (!cfg || !cfg.id) throw new Error("TenantManager.registerTenant: missing id");
    if (this.tenants.has(cfg.id)) throw new Error(`Tenant with id "${cfg.id}" already registered`);

    // ensure hostnames normalized
    const normalized = { ...cfg, hostnames: (cfg.hostnames || []).map((h: string) => h.toLowerCase()) };
    this.tenants.set(cfg.id, normalized);
    console.log(this.tenants)
  }

  // register tenants
  async registerTenants(cfgs: TenantConfig[]): Promise<void> {
    for (const cfg of cfgs) {
      await this.registerTenant(cfg);
    }
  }

  getTenant(id: string): TenantConfig | undefined {
    return this.tenants.get(id);
  }

  getTenantByHost(host: string): TenantConfig | undefined {
    if (!host) return undefined;
    const normalized = host.toLowerCase().split(":")[0]; // drop port if present
    for (const t of this.tenants.values()) {
      if (!t.hostnames) continue;
      for (const h of t.hostnames) {
        if (h === normalized) return t;
        // support wildcard prefix like *.example.com
        if (h.startsWith("*.") && normalized.endsWith(h.slice(1))) return t;
      }
    }
    return undefined;
  }

  listTenants(): TenantConfig[] {
    return Array.from(this.tenants.values());
  }

  async removeTenant(id: string): Promise<void> {
    const t = this.tenants.get(id);
    if (!t) return;
    // attempt to close Deno.Kv if present (best-effort)
    try {
      if (t.kv && typeof t.kv.close === "function") {
        await t.kv.close();
      }
    } catch (e) {
      // swallow; removal should be best-effort
      console.warn("TenantManager: error closing tenant resources", e);
    }
    this.tenants.delete(id);
  }

  setResolver(resolver: TenantResolver): void {
    this.container.register("tenantResolver", resolver);
  }

  // @TODO
  resolve(ctx: any): Promise<Tenant | null> {
    const tenant = ctx.tenant || ctx.state.tenant || ctx.session?.tenant;
    return tenant || this.tenants.values().next().value;
  }

  getContainer(id?: string): Container {
    const container = this.container.resolve<Container>("container") || this.container;
    if (id) {
      // console.log(container.resolve<Container>(`tenant:${id}`))
      return container.resolve<Container>(`tenant:${id}`) || container;
    }
    return container;
  }
}



export class DefaultTenantResolver implements TenantResolver {
  resolve(ctx: any): Promise<Tenant | null> {
    throw new Error("Method not implemented.");
  }
}