// engine/mod.ts
/**
 * OakSeed Engine - Main Export
 * Reusable multi-tenant plugin framework for Deno
 */

// Core exports
export * from "./core/kernel.ts";
export * from "./core/container.ts";
export * from "./core/plugin_manager.ts";
export * from "./core/tenant_manager.ts";
export * from "./core/worker_manager.ts";
export * from "./core/view_engine.ts";
export * from "./core/router.ts";
export * from "./core/config.ts";

// Type exports
export * from "./core/types.ts";

// Module exports
export * from "./modules/logger.ts";
export * from "./modules/events.ts";
export * as utils from "./modules/utils.ts";

// Middleware exports
export * from './middleware/cors/mod.ts';
export * from './middleware/debug/mod.ts';

// Version
export const VERSION = "1.0.0";

