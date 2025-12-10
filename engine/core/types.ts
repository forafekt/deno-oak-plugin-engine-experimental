// engine/core/types.ts
/**
 * Core type definitions for the Cortex Engine
 * These interfaces define the contracts for all engine components
 */

import { Context, Middleware } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { LoggerOptions } from "../modules/logger.ts";

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

/**
 * Plugin interface - all plugins must implement this
 */
export interface Plugin {
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
  
  // Lifecycle hooks
  init?(container: Container, config: PluginConfig): Promise<void>;
  boot?(container: Container): Promise<void>;
  shutdown?(container: Container): Promise<void>;
  
  // Optional features
  routes?: RouteDefinition[];
  workers?: WorkerDefinition[];
  middleware?: Middleware[];
  viewPaths?: string[];
  assetPaths?: string[];
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
  [key: string]: unknown;
}

/**
 * Route definition for plugins
 */
export interface RouteDefinition {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  handler: (ctx: Context, container: Container) => Promise<void> | void;
  middleware?: Middleware[];
  tenant?: boolean; // If true, route is tenant-scoped
}

/**
 * Worker definition
 */
export interface WorkerDefinition {
  name: string;
  handler: WorkerHandler;
  schedule?: string; // Cron expression for scheduled workers
}

export type WorkerHandler = (
  payload: WorkerPayload,
  container: Container
) => Promise<WorkerResult>;

export interface WorkerPayload {
  tenantId?: string;
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface WorkerResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Tenant definition
 */
export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  subdomain?: string;
  config: TenantConfig;
  plugins: string[]; // Plugin names to enable
  metadata?: Record<string, unknown>;
}

export interface TenantConfig {
  database?: DatabaseConfig;
  cache?: CacheConfig;
  theme?: string;
  viewOverrides?: Record<string, string>;
  [key: string]: unknown;
}

export interface DatabaseConfig {
  type: "mysql" | "sqlite" | "postgres" | "denokv";
  connection: string | Record<string, unknown>;
}

export interface CacheConfig {
  type: "memory" | "redis" | "denokv";
  connection?: string | Record<string, unknown>;
}

/**
 * Dependency Injection Container
 */
export interface Container {
  // Service registration
  register<T>(name: string, instance: T): void;
  registerFactory<T>(
    name: string,
    factory: (container: Container) => T | Promise<T>
  ): void;
  registerSingleton<T>(
    name: string,
    factory: (container: Container) => T | Promise<T>
  ): void;
  
  // Service resolution
  resolve<T>(name: string): T;
  resolveAsync<T>(name: string): Promise<T>;
  has(name: string): boolean;
  
  // Scoping
  createChild(): Container;
  getParent(): Container | null;
}

/**
 * Tenant resolver interface
 */
export interface TenantResolver {
  resolve(ctx: Context): Promise<Tenant | null>;
}

/**
 * View engine interface
 */
export interface ViewEngine {
  render(
    view: string,
    data: Record<string, unknown>,
    options?: ViewRenderOptions
  ): Promise<string>;
  addPath(path: string): void;
  setTenant(tenant: Tenant | null): void;
}

export interface ViewRenderOptions {
  layout?: string;
  tenant?: Tenant;
  plugin?: string;
}

/**
 * Event system
 */
export interface EventEmitter {
  on(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;
  emit(event: string, data?: unknown): void;
  once(event: string, handler: EventHandler): void;
}

export type EventHandler = (data?: unknown) => void | Promise<void>;

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

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