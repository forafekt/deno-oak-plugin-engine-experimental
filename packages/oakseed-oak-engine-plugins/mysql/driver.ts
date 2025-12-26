// engine/plugins/mysql/driver.ts
/**
 * MySQL Database Driver Implementation
 */

import { Client } from "@oakseed/x/mysql.ts";

import { MultiTenantEngine, engineBuilder } from "@oakseed/database-engine/mod.ts"
import { DatabaseDriver } from "@oakseed/types";
import { Logger } from "@oakseed/logger";
import { parseConnectionString } from "@oakseed/utils";

export class MySQLDriver implements DatabaseDriver {
  private client: Client;
  private connected = false;
  private logger: Logger;
  private connectionString: string;
  private engine: MultiTenantEngine;

  constructor(connectionString: string, logger: Logger) {
    this.connectionString = connectionString;
    this.logger = logger;
    this.client = new Client();
    
    const config = parseConnectionString(connectionString) as any;


    const builder = engineBuilder()

    const engine = builder.database(config)
                  .worker({
                    concurrency: 1,
                    maxRetries: 3,
                  })
                  .defaultIsolationStrategy("schema")
                  .tablePrefix("mt_")
                  .build("mysql");

    this.engine = engine;
                  
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      const config = parseConnectionString(this.connectionString);

      await this.client.connect({
        hostname: config.hostname,
        port: parseInt(config.port) || 3306,
        username: config.username,
        password: config.password,
        db: config.database,
      });

      this.connected = true;
      this.logger.debug("MySQL connected");
    } catch (error) {
      this.logger.error("MySQL connection failed", { error: (error as Error).message });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.close();
      this.connected = false;
      this.logger.debug("MySQL disconnected");
    } catch (error) {
      this.logger.error("MySQL disconnect failed", { error: (error as Error).message });
      throw error;
    }
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    if (!this.connected) {
      throw new Error("Database not connected");
    }

    try {
      const result = await this.client.execute(sql, params);
      return result.rows as T[];
    } catch (error) {
      this.logger.error("MySQL query failed", {
        sql,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async execute(sql: string, params?: unknown[]): Promise<number> {
    if (!this.connected) {
      throw new Error("Database not connected");
    }

    try {
      const result = await this.client.execute(sql, params);
      return result.affectedRows || 0;
    } catch (error) {
      this.logger.error("MySQL execute failed", {
        sql,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async transaction<T>(
    callback: (driver: DatabaseDriver) => Promise<T>
  ): Promise<T> {
    if (!this.connected) {
      throw new Error("Database not connected");
    }

    await this.client.execute("START TRANSACTION");

    try {
      const result = await callback(this);
      await this.client.execute("COMMIT");
      return result;
    } catch (error) {
      await this.client.execute("ROLLBACK");
      throw error;
    }
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get raw client (for advanced usage)
   */
  getClient(): Client {
    return this.client;
  }
}