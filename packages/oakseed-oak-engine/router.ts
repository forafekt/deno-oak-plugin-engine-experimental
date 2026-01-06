// deno-lint-ignore-file no-explicit-any
// core/router.ts
/**
 * Multi-Tenant Router
 * Handles route registration and tenant-aware routing with Oak integration
 */

import type {
  RouterContext,
  RouterOptions,
  RouteParams,
  RouterMiddleware,
} from "@oakseed/x/oak.ts";
import { Router } from "@oakseed/x/oak.ts";
import type { Logger } from "@oakseed/logger/mod.ts";
import type { OakSeedRouteDefinition, OakSeedRouterContract } from "@oakseed/engine-core/router.ts";
import { defineMiddlewareFactory } from "@oakseed/engine-core/middleware.ts";
import type { Tenant, TenantManager } from "@oakseed/engine-core/tenant_manager.ts";
import type { OakEngineContainer } from "./kernel.ts";

export type OakEngineRouterState<K extends PropertyKey = PropertyKey> =  { tenant: Tenant | null; container: OakEngineContainer } & Record<K, any>;

export interface OakEngineRouterMiddleware<R extends string = string, P extends RouteParams<R> = RouteParams<R>, S extends OakEngineRouterState = OakEngineRouterState> extends RouterMiddleware<R, P, S> {
}



export class OakRouter<R extends string = string, P extends RouteParams<R> = RouteParams<R>, S extends OakEngineRouterState = OakEngineRouterState> implements OakSeedRouterContract<Router, OakEngineRouterMiddleware<R, P, S>> {
  router: Router;
  globalContainer: OakEngineContainer;
  tenantManager: TenantManager;
  logger: Logger;
  routes: OakSeedRouteDefinition<OakEngineRouterMiddleware<R, P, S>>[] = [];

  constructor(
    opts: RouterOptions = {
      methods: undefined,
      prefix: undefined,
      routerPath: undefined,
      sensitive: undefined,
      strict: undefined,
    },
    globalContainer: OakEngineContainer,
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
  register(route: OakSeedRouteDefinition<OakEngineRouterMiddleware<R, P, S>, OakEngineRouterMiddleware<R, P, S>, OakEngineContainer>): void {
    this.routes.push(route);

    const routeName = route.name || `${route.method} ${route.path}`;

    this.logger.debug(`Registering route: ${routeName}`, {
      tenant: route.tenant || false,
      path: route.path,
      containerType: this.globalContainer.constructor.name,
    });

    const handler = async (ctx: RouterContext<R, P, S>, next: () => Promise<unknown>) => {
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
          ctx.cookies.set("tenant", tenant.id);

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
        const factory = defineMiddlewareFactory<OakEngineRouterMiddleware<R, P, S>>(route.handler);
        const middleware = factory({ container, tenant });
        return middleware(ctx, next);
      } catch (error) {
        this.logger.error(`Route handler error: ${route.path}`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        ctx.response.status = 500;
        ctx.response.body = {
          error: "Internal server error",
          message: Deno.env.get("DENO_ENV") === "development"
              ? error instanceof Error
                ? error.message
                : String(error)
              : undefined,
        };
      }
    };

    // Apply route middleware if any
    // TODO also apply tenant awareness in the middlewares
    const middlewares = (route.middleware || []).map((mw) => {
      const factory = defineMiddlewareFactory(mw);
      const middleware = factory({ container: this.globalContainer, tenant: null });
      return middleware;
    });

    this.router.add<R, P, S>(route.method, route.path as R, handler, ...middlewares);
    this.logger.debug(`Route registered successfully: ${routeName}`);
  }

  /**
   * Register multiple routes
   */
  registerRoutes(routes: OakSeedRouteDefinition<OakEngineRouterMiddleware<R, P, S>>[]): void {
    this.logger.info(`Registering ${routes.length} routes`);
    for (const route of routes) {
      this.register(route);
    }
  }

  /**
   * Get Oak router
   */
  getRouter() {
    return this.router;
  }

  /**
   * Get all registered routes
   */
  getRoutes(): OakSeedRouteDefinition<OakEngineRouterMiddleware<R, P, S>>[] {
    return [...this.routes];
  }

  /**
   * Get routes by tenant requirement
   */
  getTenantRoutes(): OakSeedRouteDefinition<OakEngineRouterMiddleware<R, P, S>>[] {
    return this.routes.filter((r) => r.tenant);
  }

  /**
   * Get global routes (non-tenant)
   */
  getGlobalRoutes(): OakSeedRouteDefinition<OakEngineRouterMiddleware<R, P, S>>[] {
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
