// // engine/core/types.ts
// /**
//  * Core type definitions for the OakSeed Engine
//  * These interfaces define the contracts for all engine components
//  */

import { Context, Middleware } from "@oakseed/x/oak.ts";
import { LoggerOptions } from "../modules/logger.ts";
import { Tenant, TenantResolver } from "./tenant_manager.ts";
import { Plugin } from "./plugin_manager.ts";
import { Container } from "./container.ts";

/**
 * Base configuration for the engine
 */
export interface OakSeedConfig {
  port?: number;
  hostname?: string;
  env?: "development" | "production" | "test";
  logger?: LoggerOptions;
  viewPaths?: string[];
  assetPaths?: string[];
  pluginPaths?: string[];
  debug?: boolean;
}

// export interface DatabaseConfig {
//   type: "mysql" | "sqlite" | "postgres" | "denokv";
//   connection: string | Record<string, unknown>;
// }

// export interface CacheConfig {
//   type: "memory" | "redis" | "denokv";
//   connection?: string | Record<string, unknown>;
// }

// /**
//  * Event system
//  */
// export interface EventEmitter {
//   on(event: string, handler: EventHandler): void;
//   off(event: string, handler: EventHandler): void;
//   emit(event: string, data?: unknown): void;
//   once(event: string, handler: EventHandler): void;
// }

// export type EventHandler = (data?: unknown) => void | Promise<void>;

/**
 * Database driver interface
 */
export interface DatabaseDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<number>;
  transaction<T>(callback: (driver: DatabaseDriver) => Promise<T>): Promise<T>;
}

/**
 * Cache driver interface
 */
export interface CacheDriver {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

/**
 * Bootstrap options for the engine
 */
export interface BootstrapOptions {
  config: OakSeedConfig;
  // configFilename?: string;
  plugins?: Plugin[];
  tenants?: Tenant[];
  tenantsFile?: string;
  middleware?: Middleware[];
  tenantResolver?: TenantResolver;
  container?: Container;
  env?: string | Record<string, any>;
  deno?:
    | Record<string, any>
    | ((denoJson: Record<string, any>) => Record<string, any>);
}

export type DefineConfig<T extends Record<string, any>> = BootstrapOptions & T;

// export function defineConfig<T extends Record<string, any>>(
//   $: DefineConfig<T>
// ) {

//   try {
//     const $denoJson = Deno.readTextFileSync("./deno.json");
//     if (typeof $.deno !== "function") {
//       $.deno = { ...JSON.parse($denoJson), ...$.deno };
//     } else {
//       $.deno = (denoJson: Record<string, any>) => ({
//         ...JSON.parse($denoJson),
//         ...denoJson,
//       });
//     }
//   } catch (error) {
//     console.error(error);
//   }

//   try {
//     if (typeof $.env === "string") {
//       $.env = readEnvFile($.env);
//     } else if (typeof $.env === "object") {
//       $.env = { ...$.env };
//     } else {
//       $.env = {};
//     }
//   } catch (error) {
//     console.error(error);
//   }

//   console.log($)

//   return $;
// }

// env.ts
// export function readEnvFile(
//   path = ".env",
// ) {
//   const text = Deno.readTextFileSync(path);
//   const env: Record<string, string> = {};

//   for (const line of text.split("\n")) {
//     const trimmed = line.trim();

//     // Skip empty lines and comments
//     if (!trimmed || trimmed.startsWith("#")) continue;

//     const eqIndex = trimmed.indexOf("=");
//     if (eqIndex === -1) continue;

//     const key = trimmed.slice(0, eqIndex).trim();
//     let value = trimmed.slice(eqIndex + 1).trim();

//     // Remove surrounding quotes
//     if (
//       (value.startsWith('"') && value.endsWith('"')) ||
//       (value.startsWith("'") && value.endsWith("'"))
//     ) {
//       value = value.slice(1, -1);
//     }

//     env[key] = value;
//   }

//   return env;
// }
