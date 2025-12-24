import { MultiTenantEngine } from "./engine.ts";

// types.ts
export interface TenantConfig {
  id: string;
  name: string;
  isolationStrategy: "schema" | "database" | "prefix";
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
  ssl?: boolean;
  connectionLimit?: number;
  acquireTimeout?: number;
  timeout?: number;
}

export interface WorkerConfig {
  concurrency?: number;
  pollInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  cleanupInterval?: number;
}

export interface EngineConfig {
  database: DatabaseConfig;
  worker?: WorkerConfig;
  defaultIsolationStrategy?: "schema" | "database" | "prefix";
  tablePrefix?: string;
}

export interface Job {
  id: string;
  tenantId: string | null;
  type: string;
  payload: Record<string, unknown>;
  priority: number;
  attempts: number;
  maxRetries: number;
  scheduledAt: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | undefined;
  failedAt?: Date | undefined;
  error?: string | undefined;
}

export interface JobOptions {
  priority?: number;
  delay?: number;
  maxRetries?: number;
  tenantId?: string;
}

export type JobHandler<T = any> = (
  payload: T,
  context: JobContext,
) => Promise<void>;

export interface JobContext {
  job: Job;
  tenantId: string | null;
  attempt: number;
  dataAccess: DataAccess;
}

export interface DataAccess {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(
    sql: string,
    params?: any[],
  ): Promise<{ affectedRows: number; insertId?: number | undefined }>;
  transaction<T>(fn: (tx: DataAccess) => Promise<T>): Promise<T>;
}

export interface DatabaseAdapter {
  connect(config: DatabaseConfig): Promise<void>;
  disconnect(): Promise<void>;
  createTenant(tenant: TenantConfig): Promise<void>;
  getTenant(id: string): Promise<TenantConfig | null>;
  listTenants(): Promise<TenantConfig[]>;
  updateTenant(id: string, updates: Partial<TenantConfig>): Promise<void>;
  deleteTenant(id: string): Promise<void>;
  getDataAccess(tenantId?: string): DataAccess;
  setupSchema(): Promise<void>;
  cleanup(): Promise<void>;
}

export interface WorkerAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  addJob(
    type: string,
    payload: Record<string, unknown>,
    options?: JobOptions,
  ): Promise<string>;
  registerHandler<T>(type: string, handler: JobHandler<T>): void;
  processJobs(): Promise<void>;
}

export interface Plugin {
  name: string;
  version: string;
  install(engine: MultiTenantEngine): Promise<void>;
  uninstall?(engine: MultiTenantEngine): Promise<void>;
}
