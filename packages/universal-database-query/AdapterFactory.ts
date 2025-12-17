// deno-lint-ignore-file no-case-declarations
import {
  DatabaseAdapter,
  DatabaseConfig,
  QueryResult,
  TransactionAdapter,
} from "./types.ts";

// AdapterFactory.ts
export class AdapterFactory {
  static async createAdapter(config: DatabaseConfig): Promise<DatabaseAdapter> {
    switch (config.type) {
      case "mysql":
        const { MySQLAdapter } = await import("./adapters/mysql.ts");
        return new MySQLAdapter(config);
      case "postgresql":
        const { PostgreSQLAdapter } = await import("./adapters/postgresql.ts");
        return new PostgreSQLAdapter(config);
      case "sqlite":
        const { SQLiteAdapter } = await import("./adapters/sqlite.ts");
        return new SQLiteAdapter(config);
      case "oracle":
        const { OracleAdapter } = await import("./adapters/oracle.ts");
        return new OracleAdapter(config);
      case "mongodb":
        const { MongoDBAdapter } = await import("./adapters/mongodb.ts");
        return new MongoDBAdapter(config);
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  static async initializeAdapter(
    config: DatabaseConfig,
  ): Promise<DatabaseAdapter> {
    const adapter = await this.createAdapter(config);
    await adapter.connect();
    return adapter;
  }

  static async disconnectAdapter(adapter: DatabaseAdapter): Promise<void> {
    await adapter.disconnect();
  }

  static async executeQuery(
    adapter: DatabaseAdapter,
    query: string,
    params?: any[],
  ): Promise<QueryResult> {
    return adapter.query(query, params);
  }

  static async executeUpdate(
    adapter: DatabaseAdapter,
    query: string,
    params?: any[],
  ): Promise<QueryResult> {
    return adapter.execute(query, params);
  }

  static async executeTransaction(
    adapter: DatabaseAdapter,
    callback: (tx: TransactionAdapter) => Promise<void>,
  ): Promise<void> {
    await adapter.transaction(callback);
  }
}
