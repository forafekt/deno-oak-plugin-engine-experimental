// mod.ts
export * from "./types.ts";
export * from "./engine.ts";
export * from "./adapters/mysql.ts";
export * from "./adapters/worker.ts";

import { MultiTenantEngine } from "./engine.ts";
import { MySQLAdapter } from "./adapters/mysql.ts";
import { BackgroundWorkerAdapter } from "./adapters/worker.ts";
import type { DatabaseAdapter, EngineConfig } from "./types.ts";

/**
 * Factory function to create a MultiTenantEngine with MySQL support
 */
export function createMySQLEngine(config: EngineConfig): MultiTenantEngine {
  const databaseAdapter = new MySQLAdapter(
    config.database,
    config.tablePrefix || "mt_",
  );

  const workerAdapter = new BackgroundWorkerAdapter(
    databaseAdapter,
    config.worker,
  );

  return new MultiTenantEngine(databaseAdapter, workerAdapter, config);
}

/**
 * Builder pattern for more complex configurations
 */
export class EngineBuilder {
  private config: Partial<EngineConfig> = {};

  database(config: EngineConfig["database"]): this {
    this.config.database = config;
    return this;
  }

  worker(config: EngineConfig["worker"]): this {
    if (config) {
      this.config.worker = config;
    }
    return this;
  }

  defaultIsolationStrategy(strategy: "schema" | "database" | "prefix"): this {
    this.config.defaultIsolationStrategy = strategy;
    return this;
  }

  tablePrefix(prefix: string): this {
    this.config.tablePrefix = prefix;
    return this;
  }

  // buildMySQL(): MultiTenantEngine {
  //   if (!this.config.database) {
  //     throw new Error("Database configuration is required");
  //   }

  //   return createMySQLEngine(this.config as EngineConfig);
  // }

  build(adapter: DatabaseAdapter | 'mysql'): MultiTenantEngine {
  const databaseAdapter = adapter === 'mysql' ? new MySQLAdapter(this.config.database!, this.config.tablePrefix || "mt_") : adapter;

  const workerAdapter = new BackgroundWorkerAdapter(
    databaseAdapter,
    this.config.worker,
  );

  return new MultiTenantEngine(databaseAdapter, workerAdapter, this.config);
}
}

export function engineBuilder(): EngineBuilder {
  return new EngineBuilder();
}
