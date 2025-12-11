// // engine/core/types.ts
// /**
//  * Core type definitions for the Cortex Engine
//  * These interfaces define the contracts for all engine components
//  */

import { Context, Middleware } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { LoggerOptions } from "../modules/logger.ts";
import { Tenant, TenantResolver } from "./tenant-manager.ts";
import { Plugin } from "./plugin-manager.ts";
import { Container } from "./container.ts";

/**
 * Base configuration for the engine
 */
export interface CortexConfig {
  port?: number;
  hostname?: string;
  env?: "development" | "production" | "test";
  logger?: LoggerOptions;
  viewPaths?: string[];
  assetPaths?: string[];
  pluginPaths?: string[];
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
  config: CortexConfig | string;
  // configFilename?: string;
  plugins?: Plugin[];
  tenants?: Tenant[];
  tenantsFile?: string;
  middleware?: Middleware[];
  tenantResolver?: TenantResolver;
  container?: Container;
}