// deno-lint-ignore-file no-explicit-any
// engine/mod.ts
/**
 * DenoBoot Engine - Main Export
 * Reusable multi-tenant plugin framework for Deno
 */

import { DenoBootEnginePlugin } from "@denoboot/engine-core/plugin_manager.ts";
import { OakEngineAppMiddleware, OakEngineContainer } from "./kernel.ts";
import { OakEngineRouterMiddleware } from "./router.ts";
import { DenoBootWorkerDefinition } from "@denoboot/engine-core/worker_manager.ts";
import { DenoBootRouteDefinition } from "@denoboot/engine-core/router.ts";

// Core exports
export * from "./kernel.ts";
export * from "./router.ts";

// Version
export const VERSION = "1.0.0";

export function defineOakPlugin($: DenoBootEnginePlugin<OakEngineAppMiddleware, OakEngineRouterMiddleware, OakEngineRouterMiddleware, OakEngineContainer>) {
    $.routes = $.routes?.map(defineOakPluginRoute);
    $.workers = $.workers?.map(defineOakPluginWorker);
    $.middleware = $.middleware?.map(defineOakPluginMiddleware);
    return $;
}

export function defineOakPluginRoute<T extends Record<string, unknown> = Record<string, unknown>>($: DenoBootRouteDefinition<OakEngineRouterMiddleware, OakEngineRouterMiddleware, OakEngineContainer<T>>) {
    return $;
}

export function defineOakPluginWorker($: DenoBootWorkerDefinition) {
    return $;
}

export function defineOakPluginMiddleware<S extends Record<PropertyKey, any> = Record<string, any>>($: OakEngineAppMiddleware<S>) {
    return $;
}