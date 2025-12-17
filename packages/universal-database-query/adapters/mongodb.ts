import {
  DatabaseAdapter,
  DatabaseConfig,
  QueryResult,
  TransactionAdapter,
  UniversalQuery,
} from "../types.ts";

export class MongoDBAdapter implements DatabaseAdapter {
  constructor(private config: DatabaseConfig) {}

  connect(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  disconnect(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  query(sql: string, params?: any[]): Promise<QueryResult> {
    throw new Error("Method not implemented.");
  }
  execute(sql: string, params?: any[]): Promise<QueryResult> {
    throw new Error("Method not implemented.");
  }
  transaction<T>(callback: (tx: TransactionAdapter) => Promise<T>): Promise<T> {
    throw new Error("Method not implemented.");
  }
  isConnected(): boolean {
    throw new Error("Method not implemented.");
  }
  translateQuery(query: UniversalQuery): string {
    throw new Error("Method not implemented.");
  }
  formatParameter(index: number): string {
    throw new Error("Method not implemented.");
  }
}
