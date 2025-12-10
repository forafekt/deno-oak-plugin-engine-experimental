// engine/plugins/mysql/driver.ts
/**
 * MySQL Database Driver Implementation
 */

import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";
import { DatabaseDriver, Logger } from "../../core/types.ts";
import { parseConnectionString } from "../../modules/utils.ts";

export class MySQLDriver implements DatabaseDriver {
  private client: Client;
  private connected = false;
  private logger: Logger;
  private connectionString: string;

  constructor(connectionString: string, logger: Logger) {
    this.connectionString = connectionString;
    this.logger = logger;
    this.client = new Client();
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
      this.logger.error("MySQL connection failed", { error: error.message });
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
      this.logger.error("MySQL disconnect failed", { error: error.message });
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
        error: error.message,
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
        error: error.message,
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