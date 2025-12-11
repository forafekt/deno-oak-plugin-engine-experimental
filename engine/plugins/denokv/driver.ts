// engine/plugins/denokv/driver.ts
/**
 * Deno KV Driver Implementation
 * Can be used as both database and cache
 */

import { CacheDriver, DatabaseDriver } from "../../core/types.ts";
import { Logger } from "../../modules/logger.ts";

export class DenoKVDriver implements DatabaseDriver, CacheDriver {
  private kv: Deno.Kv | null = null;
  private connected = false;
  private logger: Logger;
  private path?: string;
  private prefix: string[];

  constructor(path: string | undefined, logger: Logger, tenantId: string) {
    this.path = path;
    this.logger = logger;
    this.prefix = ["tenant", tenantId];
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      this.kv = await Deno.openKv(this.path);
      this.connected = true;
      this.logger.debug(`Deno KV connected${this.path ? `: ${this.path}` : ""}`);
    } catch (error) {
      this.logger.error("Deno KV connection failed", { error: error.message });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.kv) return;

    try {
      this.kv.close();
      this.kv = null;
      this.connected = false;
      this.logger.debug("Deno KV disconnected");
    } catch (error) {
      this.logger.error("Deno KV disconnect failed", { error: error.message });
      throw error;
    }
  }

  // Database Driver Methods

  async query<T>(collection: string, filter?: unknown): Promise<T[]> {
    if (!this.connected || !this.kv) {
      throw new Error("KV not connected");
    }

    try {
      const results: T[] = [];
      const prefix = [...this.prefix, collection];
      
      const entries = this.kv.list<T>({ prefix });
      
      for await (const entry of entries) {
        results.push(entry.value);
      }

      return results;
    } catch (error) {
      this.logger.error("Deno KV query failed", {
        collection,
        error: error.message,
      });
      throw error;
    }
  }

  async execute(collection: string, operation: string, data?: unknown): Promise<number> {
    if (!this.connected || !this.kv) {
      throw new Error("KV not connected");
    }

    try {
      switch (operation) {
        case "set": {
          const { key, value } = data as { key: string; value: unknown };
          await this.kv.set([...this.prefix, collection, key], value);
          return 1;
        }
        case "delete": {
          const { key } = data as { key: string };
          await this.kv.delete([...this.prefix, collection, key]);
          return 1;
        }
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      this.logger.error("Deno KV execute failed", {
        collection,
        operation,
        error: error.message,
      });
      throw error;
    }
  }

  async transaction<T>(
    callback: (driver: DatabaseDriver) => Promise<T>
  ): Promise<T> {
    if (!this.connected || !this.kv) {
      throw new Error("KV not connected");
    }

    // Deno KV supports atomic operations
    // This is a simplified implementation
    return await callback(this);
  }

  // Cache Driver Methods

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected || !this.kv) {
      throw new Error("KV not connected");
    }

    try {
      const result = await this.kv.get<T>([...this.prefix, "cache", key]);
      return result.value;
    } catch (error) {
      this.logger.error("Deno KV get failed", {
        key,
        error: error.message,
      });
      throw error;
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (!this.connected || !this.kv) {
      throw new Error("KV not connected");
    }

    try {
      const options = ttl ? { expireIn: ttl * 1000 } : undefined;
      await this.kv.set([...this.prefix, "cache", key], value, options);
    } catch (error) {
      this.logger.error("Deno KV set failed", {
        key,
        error: error.message,
      });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.connected || !this.kv) {
      throw new Error("KV not connected");
    }

    try {
      await this.kv.delete([...this.prefix, "cache", key]);
    } catch (error) {
      this.logger.error("Deno KV delete failed", {
        key,
        error: error.message,
      });
      throw error;
    }
  }

  async clear(): Promise<void> {
    if (!this.connected || !this.kv) {
      throw new Error("KV not connected");
    }

    try {
      const entries = this.kv.list({ prefix: [...this.prefix, "cache"] });
      
      for await (const entry of entries) {
        await this.kv.delete(entry.key);
      }
    } catch (error) {
      this.logger.error("Deno KV clear failed", { error: error.message });
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.connected || !this.kv) {
      throw new Error("KV not connected");
    }

    try {
      const result = await this.kv.get([...this.prefix, "cache", key]);
      return result.value !== null;
    } catch (error) {
      this.logger.error("Deno KV has failed", {
        key,
        error: error.message,
      });
      throw error;
    }
  }

  // Utility methods

  isConnected(): boolean {
    return this.connected;
  }

  getKV(): Deno.Kv | null {
    return this.kv;
  }

  /**
   * Store a document in a collection
   */
  async store(collection: string, id: string, data: unknown): Promise<void> {
    if (!this.connected || !this.kv) {
      throw new Error("KV not connected");
    }

    await this.kv.set([...this.prefix, collection, id], data);
  }

  /**
   * Retrieve a document from a collection
   */
  async retrieve<T>(collection: string, id: string): Promise<T | null> {
    if (!this.connected || !this.kv) {
      throw new Error("KV not connected");
    }

    const result = await this.kv.get<T>([...this.prefix, collection, id]);
    return result.value;
  }

  /**
   * Remove a document from a collection
   */
  async remove(collection: string, id: string): Promise<void> {
    if (!this.connected || !this.kv) {
      throw new Error("KV not connected");
    }

    await this.kv.delete([...this.prefix, collection, id]);
  }
}