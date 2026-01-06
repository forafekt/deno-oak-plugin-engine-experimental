// engine/mod.ts
/**
 * OakSeed Engine - Main Export
 * Reusable multi-tenant plugin framework for Deno
 */

import { OakSeedEnginePlugin } from "@oakseed/engine-core/plugin_manager.ts";
import { OakEngineAppMiddleware, OakEngineContainer } from "./kernel.ts";
import { OakEngineRouterMiddleware } from "./router.ts";

// Core exports
export * from "./kernel.ts";
export * from "./router.ts";

// Version
export const VERSION = "1.0.0";

export function defineOakPlugin($: OakSeedEnginePlugin<OakEngineAppMiddleware, OakEngineRouterMiddleware, OakEngineRouterMiddleware, OakEngineContainer>) {
    return $;
}