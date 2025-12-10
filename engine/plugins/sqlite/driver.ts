// engine/plugins/sqlite/driver.ts
/**
 * SQLite Database Driver Implementation
 */

import { DB } from "https://deno.land/x/sqlite@v3.8/mod.ts";
import { DatabaseDriver, Logger } from "../../core/types.ts";

export class SQLiteDriver implements DatabaseDriver {
  private db: DB | null = null;
  private connected = false;
  private logger: Logger;
  private dbPath: string;

  constructor(dbPath: string, logger: Logger) {
    this.dbPath = dbPath;
    this.logger = logger;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      this.db = new DB(this.dbPath);
      this.connected = true;
      this.logger.debug(`SQLite connected: ${this.dbPath}`);
    } catch (error) {
      this.logger.error("SQLite connection failed", { error: error.message });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.db) return;

    try {
      this.db.close();
      this.db = null;
      this.connected = false;
      this.logger.debug("SQLite disconnected");
    } catch (error) {
      this.logger.error("SQLite disconnect failed", { error: error.message });
      throw error;
    }
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    if (!this.connected || !this.db) {
      throw new Error("Database not connected");
    }

    try {
      const rows = this.db.queryEntries<T>(sql, params);
      return rows;
    } catch (error) {
      this.logger.error("SQLite query failed", {
        sql,
        error: error.message,
      });
      throw error;
    }
  }

  async execute(sql: string, params?: unknown[]): Promise<number> {
    if (!this.connected || !this.db) {
      throw new Error("Database not connected");
    }

    try {
      this.db.query(sql, params);
      return this.db.changes;
    } catch (error) {
      this.logger.error("SQLite execute failed", {
        sql,
        error: error.message,
      });
      throw error;
    }
  }

  async transaction<T>(
    callback: (driver: DatabaseDriver) => Promise<T>
  ): Promise<T> {
    if (!this.connected || !this.db) {
      throw new Error("Database not connected");
    }

    this.db.query("BEGIN TRANSACTION");

    try {
      const result = await callback(this);
      this.db.query("COMMIT");
      return result;
    } catch (error) {
      this.db.query("ROLLBACK");
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
   * Get raw DB instance (for advanced usage)
   */
  getDB(): DB | null {
    return this.db;
  }
}