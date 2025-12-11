// engine/core/router.ts
/**
 * Multi-Tenant Router
 * Handles route registration and tenant-aware routing
 */

import {
  Router,
  Middleware,
} from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { Tenant, TenantContext, TenantManager } from "./tenant-manager.ts";
import { Container } from "./container.ts";
import { Logger } from "../modules/logger.ts";


/**
 * Route definition for plugins
 */
export interface RouteDefinition {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  handler: (ctx: TenantContext, container: Container) => Promise<void> | void;
  middleware?: Middleware[];
  tenant?: boolean; // If true, route is tenant-scoped
}

export class CortexRouter {
  private router: Router;
  private logger: Logger;
  private tenantManager: TenantManager;
  private globalContainer: Container;
  private routes: RouteDefinition[] = [];

  constructor(
    globalContainer: Container,
    tenantManager: TenantManager,
    logger: Logger
  ) {
    this.router = new Router();
    this.globalContainer = globalContainer;
    this.tenantManager = tenantManager;
    this.logger = logger;
  }

  /**
   * Register a route
   */
  register(route: RouteDefinition): void {
    this.routes.push(route);

    const handler = async (ctx: TenantContext) => {
      try {
        // Resolve tenant if route is tenant-scoped
        let container = this.globalContainer;
        let tenant: Tenant | null = null;

        if (route.tenant) {
          tenant = await this.tenantManager.resolve(ctx);
          
          if (!tenant) {
            ctx.response.status = 404;
            ctx.response.body = { error: "Tenant not found" };
            return;
          }

          const tenantContainer = this.tenantManager.getContainer(tenant.id);
          if (tenantContainer) {
            container = tenantContainer;
          }
        }

        // Set tenant in context state
        ctx.state.tenant = tenant;
        ctx.state.container = container;

        // Execute handler
        await route.handler(ctx, container);
      } catch (error) {
        this.logger.error(`Route handler error: ${route.path}`, {
          error: error.message,
          stack: error.stack,
        });

        ctx.response.status = 500;
        ctx.response.body = {
          error: "Internal server error",
          message: Deno.env.get("DENO_ENV") === "development"
            ? error.message
            : undefined,
        };
      }
    };

    // Apply route middleware
    const middlewares: Middleware[] = route.middleware || [];

    switch (route.method) {
      case "GET":
        this.router.get(route.path, handler, ...middlewares);
        break;
      case "POST":
        this.router.post(route.path, handler, ...middlewares);
        break;
      case "PUT":
        this.router.put(route.path, handler, ...middlewares);
        break;
      case "DELETE":
        this.router.delete(route.path, handler, ...middlewares);
        break;
      case "PATCH":
        this.router.patch(route.path, handler, ...middlewares);
        break;
    }

    this.logger.debug(`Route registered: ${route.method} ${route.path}`);
  }

  /**
   * Register multiple routes
   */
  registerRoutes(routes: RouteDefinition[]): void {
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
}