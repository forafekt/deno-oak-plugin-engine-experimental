import { AdapterFactory } from "./AdapterFactory.ts";
import {
  DatabaseAdapter,
  DatabaseConfig,
  QueryResult,
  TransactionAdapter,
} from "./types.ts";
import { UniversalQueryBuilder } from "./UniversalQueryBuilder.ts";

// Enhanced Database Provider
export class DatabaseProvider {
  private adapter!: DatabaseAdapter;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.adapter = await AdapterFactory.createAdapter(this.config);
  }

  async connect(): Promise<void> {
    if (!this.adapter) {
      await this.initialize();
    }
    await this.adapter.connect();
  }

  async disconnect(): Promise<void> {
    if (this.adapter) {
      await this.adapter.disconnect();
    }
  }

  // Raw SQL query (for complex queries)
  rawQuery(sql: string, params?: any[]): Promise<QueryResult> {
    return this.adapter.query(sql, params);
  }

  // Universal query interface
  query(builder: UniversalQueryBuilder): Promise<QueryResult> {
    const { query, params } = builder.build();
    const sql = this.adapter.translateQuery(query);
    return this.adapter.query(sql, params);
  }

  execute(builder: UniversalQueryBuilder): Promise<QueryResult> {
    const { query, params } = builder.build();
    const sql = this.adapter.translateQuery(query);
    return this.adapter.execute(sql, params);
  }

  transaction<T>(
    callback: (
      tx: TransactionAdapter,
      qb: typeof UniversalQueryBuilder,
    ) => Promise<T>,
  ): Promise<T> {
    return this.adapter.transaction((tx) => {
      return callback(tx, UniversalQueryBuilder);
    });
  }

  isConnected(): boolean {
    return this.adapter.isConnected() || false;
  }

  createQueryBuilder(): UniversalQueryBuilder {
    return new UniversalQueryBuilder();
  }
}
