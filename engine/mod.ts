// engine/mod.ts
/**
 * Cortex Engine - Main Export
 * Reusable multi-tenant plugin framework for Deno
 */

// Core exports
export * from "./core/kernel.ts";
export * from "./core/container.ts";
export * from "./core/plugin-manager.ts";
export * from "./core/tenant-manager.ts";
export * from "./core/worker-manager.ts";
export * from "./core/view-engine.ts";
export * from "./core/router.ts";
export * from "./core/config.ts";

// Type exports
export * from "./core/types.ts";

// Module exports
export * from "./modules/logger.ts";
export * from "./modules/events.ts";
export * as utils from "./modules/utils.ts";

// Version
export const VERSION = "1.0.0";

