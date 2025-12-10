// engine/mod.ts
/**
 * Cortex Engine - Main Export
 * Reusable multi-tenant plugin framework for Deno
 */

// Core exports
export { CortexKernel, bootstrap } from "./core/kernel.ts";
export { DIContainer } from "./core/container.ts";
export { PluginManager } from "./core/plugin-manager.ts";
export { TenantManager, DefaultTenantResolver } from "./core/tenant-manager.ts";
export { WorkerManager } from "./core/worker-manager.ts";
export { EtaViewEngine } from "./core/view-engine.ts";
export { CortexRouter } from "./core/router.ts";
export { ConfigLoader } from "./core/config.ts";

// Type exports
export type {
  BootstrapOptions,
  CacheConfig,
  CacheDriver,
  Container,
  CortexConfig,
  DatabaseConfig,
  DatabaseDriver,
  EventEmitter,
  EventHandler,
  Logger,
  Plugin,
  PluginConfig,
  RouteDefinition,
  Tenant,
  TenantConfig,
  TenantResolver,
  ViewEngine,
  ViewRenderOptions,
  WorkerDefinition,
  WorkerHandler,
  WorkerPayload,
  WorkerResult,
} from "./core/types.ts";

// Module exports
export { createLogger, ConsoleLogger } from "./modules/logger.ts";
export { createEventEmitter, SimpleEventEmitter } from "./modules/events.ts";
export * as utils from "./modules/utils.ts";

// Version
export const VERSION = "1.0.0";

