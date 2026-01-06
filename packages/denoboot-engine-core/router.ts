// deno-lint-ignore-file no-explicit-any
// core/router.ts
/**
 * Multi-Tenant Router
 * Handles route registration and tenant-aware routing with Oak integration
 */

import type { Container } from "@denoboot/di/mod.ts";
import type { Logger } from "@denoboot/logger/mod.ts";
import type { TenantManager } from "./tenant_manager.ts";
import type { AnyMiddleware, EnhancedMiddleware } from "./middleware.ts";





export interface DenoBootRouteDefinition<TMiddleware extends AnyMiddleware = AnyMiddleware, THandler extends TMiddleware = TMiddleware, TContainer extends Container<any> = Container<any>> {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
  path: string;
  handler: EnhancedMiddleware<THandler, TContainer>;
  middleware?: EnhancedMiddleware<TMiddleware>[];
  tenant?: boolean; // If true, route requires tenant resolution
  name?: string; // Optional route name for debugging
  requiresAuth?: boolean; // If true, route requires authentication
  requiresPermissions?: boolean; // If true, route requires permissions
  requiresTenant?: boolean; // If true, route requires tenant
  type?: "api" | "view" | "static";
}

export interface DenoBootRouterContract<TRouter, TMiddleware extends AnyMiddleware = AnyMiddleware, THandler extends TMiddleware = TMiddleware, TContainer extends Container<any> = Container<any>> {
  router: TRouter;
  logger?: Logger;
  tenantManager?: TenantManager;
  globalContainer?: TContainer;
  routes: DenoBootRouteDefinition<TMiddleware, THandler, TContainer>[];

  /**
   * Register a route
   */
  register(route: DenoBootRouteDefinition<TMiddleware, THandler, TContainer>): void;

  /**
   * Register multiple routes
   */
  registerRoutes(routes: DenoBootRouteDefinition<TMiddleware, THandler, TContainer>[]): void;

  /**
   * Get Oak router
   */
  getRouter(): TRouter;

  /**
   * Get all registered routes
   */
  getRoutes(): DenoBootRouteDefinition<TMiddleware, THandler, TContainer>[];

  /**
   * Get routes by tenant requirement
   */
  getTenantRoutes(): DenoBootRouteDefinition<TMiddleware, THandler, TContainer>[];

  /**
   * Get global routes (non-tenant)
   */
  getGlobalRoutes(): DenoBootRouteDefinition<TMiddleware, THandler, TContainer>[];

  /**
   * Print route table (for debugging)
   */
  // printRoutes(): void;
}
