import { SQLTranslator } from "./SQLTranslator.ts";
import {
  DatabaseAdapter,
  DatabaseConfig,
  QueryResult,
  TransactionAdapter,
  UniversalQuery,
} from "./types.ts";

// Base adapter class
export abstract class BaseAdapter implements DatabaseAdapter {
  protected config: DatabaseConfig;
  protected connected = false;
  protected translator: SQLTranslator;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.translator = new SQLTranslator(config.type);
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract query(sql: string, params?: any[]): Promise<QueryResult>;
  abstract execute(sql: string, params?: any[]): Promise<QueryResult>;
  abstract transaction<T>(
    callback: (tx: TransactionAdapter) => Promise<T>,
  ): Promise<T>;

  isConnected(): boolean {
    return this.connected;
  }

  translateQuery(query: UniversalQuery): string {
    return this.translator.translateQuery(query);
  }

  formatParameter(index: number): string {
    return this.translator.formatParameter(index);
  }
}
