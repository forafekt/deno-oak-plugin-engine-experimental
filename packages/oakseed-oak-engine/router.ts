// core/router.ts
/**
 * Multi-Tenant Router
 * Handles route registration and tenant-aware routing with Oak integration
 */
let process;

import type {
  Middleware,
  RouterContext,
  RouterOptions,
  State as OakContextState,
  RouteParams,
} from "@oakseed/x/oak.ts";
import { Router } from "@oakseed/x/oak.ts";
import type { Container } from "@oakseed/di/mod.ts";
import type { Logger } from "@oakseed/logger/mod.ts";
import type { Tenant, TenantManager } from "./tenant_manager.ts";

export interface RouteDefinition {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
  path: string;
  handler: <R extends string, P extends RouteParams<R> = RouteParams<R>, S extends OakContextState = Record<string, any>>(ctx: RouterContext<R, P, S>, container: Container) => Promise<void> | void;
  middleware?: Middleware[];
  tenant?: boolean; // If true, route requires tenant resolution
  name?: string; // Optional route name for debugging
  requiresAuth?: boolean; // If true, route requires authentication
  requiresPermissions?: boolean; // If true, route requires permissions
  requiresTenant?: boolean; // If true, route requires tenant
  type?: "api" | "view" | "static";
}

export class OakSeedRouter {
  private router: Router;
  private logger: Logger;
  private tenantManager: TenantManager;
  private globalContainer: Container;
  private routes: RouteDefinition[] = [];

  constructor(
    opts: RouterOptions = {
      methods: undefined,
      prefix: undefined,
      routerPath: undefined,
      sensitive: undefined,
      strict: undefined,
    },
    globalContainer: Container,
    tenantManager: TenantManager,
    logger: Logger
  ) {
    this.router = new Router(opts);
    this.globalContainer = globalContainer;
    this.tenantManager = tenantManager;
    this.logger = logger;

    // this.router.get("/@fs/(.*)", async (ctx) => {
    //   const filePath = ctx.params[0];

    //   const config = this.globalContainer.resolve<any>("config");

    //   await send(ctx, filePath, {
    //     root: join(Deno.cwd(), config?.outputDir || '.out'),
    //   });
    // });
  }

  /**
   * Register a route
   */
  register(route: RouteDefinition): void {
    this.routes.push(route);

    const routeName = route.name || `${route.method} ${route.path}`;

    this.logger.debug(`Registering route: ${routeName}`, {
      tenant: route.tenant || false,
      path: route.path,
    });

    const handler = async (ctx: RouterContext<any>) => {
      let container = this.globalContainer;
      let tenant: Tenant | null = null;

      try {
        // Resolve tenant if route requires it
        if (route.tenant) {
          this.logger.debug(`Resolving tenant for route: ${route.path}`, {
            hostname: ctx.request.url.hostname,
            path: ctx.request.url.pathname,
          });

          // Create tenant context from Oak context
          const tenantContext = {
            hostname: ctx.request.url.hostname,
            path: ctx.request.url.pathname,
            tenantId: ctx.params?.tenantId,
            headers: Object.fromEntries(ctx.request.headers.entries()),
          };

          tenant = await this.tenantManager.resolve(tenantContext);

          if (!tenant) {
            this.logger.warn(`Tenant not found for route: ${route.path}`, {
              hostname: ctx.request.url.hostname,
              path: ctx.request.url.pathname,
            });

            ctx.response.status = 404;
            ctx.response.body = {
              error: "Tenant not found",
              message: "No tenant could be resolved for this request",
            };
            return;
          }

          this.logger.debug(`Tenant resolved: ${tenant.id}`, {
            tenantName: tenant.name,
          });

          const tenantContainer = this.tenantManager.getContainer(tenant.id);
          if (tenantContainer) {
            container = tenantContainer;
          } else {
            this.logger.error(`Container not found for tenant: ${tenant.id}`);
          }
        }

        // set x-oakseed-tenant header
        if (tenant) {
          ctx.response.headers.set("x-tenant-id", tenant.id);

          // store tenant cookie
          ctx.cookies.set("tenant", tenant);

          // store tenant in sessions
          if (ctx.state.session) {
            if ('set' in ctx.state.session) {
              ctx.state.session.set("tenant", tenant);
            } else {
              ctx.state.session.tenant = tenant;
            }
          }
        }

        // Set tenant and container in context state
        ctx.state.tenant = tenant;
        ctx.state.container = container;

        // Execute handler
        return route.handler(ctx, container);
      } catch (error) {
        this.logger.error(`Route handler error: ${route.path}`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        ctx.response.status = 500;
        ctx.response.body = {
          error: "Internal server error",
          message:
            (process as any).env.NODE_ENV === "development" ||
            Deno?.env?.get("DENO_ENV") === "development"
              ? error instanceof Error
                ? error.message
                : String(error)
              : undefined,
        };
      }
    };

    // Apply route middleware if any
    const middlewares: Middleware[] = route.middleware || [];

    this.router.add(route.method, route.path, handler, ...middlewares);
    this.logger.debug(`Route registered successfully: ${routeName}`);
  }

  /**
   * Register multiple routes
   */
  registerRoutes(routes: RouteDefinition[]): void {
    this.logger.info(`Registering ${routes.length} routes`);
    for (const route of routes) {
      this.register(route);
    }
  }

  /**
   * Get Oak router
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Get all registered routes
   */
  getRoutes(): RouteDefinition[] {
    return [...this.routes];
  }

  /**
   * Get routes by tenant requirement
   */
  getTenantRoutes(): RouteDefinition[] {
    return this.routes.filter((r) => r.tenant);
  }

  /**
   * Get global routes (non-tenant)
   */
  getGlobalRoutes(): RouteDefinition[] {
    return this.routes.filter((r) => !r.tenant);
  }

  /**
   * Print route table (for debugging)
   */
  printRoutes(): void {
    console.log("\n📍 Registered Routes:");
    console.log("═══════════════════════════════════════════════════════");

    const tenantRoutes = this.getTenantRoutes();
    const globalRoutes = this.getGlobalRoutes();

    if (globalRoutes.length > 0) {
      console.log("\n🌍 Global Routes:");
      for (const route of globalRoutes) {
        console.log(`  ${route.method.padEnd(6)} ${route.path}`);
      }
    }

    if (tenantRoutes.length > 0) {
      console.log("\n🏢 Tenant Routes:");
      for (const route of tenantRoutes) {
        console.log(`  ${route.method.padEnd(6)} ${route.path}`);
      }
    }

    console.log("\n═══════════════════════════════════════════════════════\n");
  }
}
