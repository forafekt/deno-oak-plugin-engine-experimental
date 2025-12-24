// types.ts
export interface DatabaseConfig {
  type: "mysql" | "postgresql" | "sqlite" | "oracle" | "mongodb";
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  filename?: string; // For SQLite
  connectionString?: string; // For custom connection strings
  options?: Record<string, any>;
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields?: string[];
}

export interface DatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query(sql: string, params?: any[]): Promise<QueryResult>;
  execute(sql: string, params?: any[]): Promise<QueryResult>;
  transaction<T>(callback: (tx: TransactionAdapter) => Promise<T>): Promise<T>;
  isConnected(): boolean;

  // Database-specific SQL generation
  translateQuery(query: UniversalQuery): string;
  formatParameter(index: number): string;
}

export interface TransactionAdapter {
  query(sql: string, params?: any[]): Promise<QueryResult>;
  execute(sql: string, params?: any[]): Promise<QueryResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface UniversalQuery {
  type:
    | "SELECT"
    | "INSERT"
    | "UPDATE"
    | "DELETE"
    | "CREATE_TABLE"
    | "DROP_TABLE";
  table: string;
  fields?: string[];
  values?: any[];
  conditions?: WhereCondition[];
  joins?: JoinClause[];
  orderBy?: OrderByClause[];
  limit?: number;
  offset?: number;
  updateData?: Record<string, any>;
  tableSchema?: TableSchema;
}

export interface WhereCondition {
  field: string;
  operator:
    | "="
    | "!="
    | "<"
    | ">"
    | "<="
    | ">="
    | "LIKE"
    | "IN"
    | "NOT IN"
    | "IS NULL"
    | "IS NOT NULL";
  value?: any;
  conjunction?: "AND" | "OR";
}

export interface JoinClause {
  type: "INNER" | "LEFT" | "RIGHT" | "FULL";
  table: string;
  condition: string;
}

export interface OrderByClause {
  field: string;
  direction: "ASC" | "DESC";
}

export interface TableSchema {
  columns: ColumnDefinition[];
  primaryKey?: string[];
  foreignKeys?: ForeignKeyDefinition[];
  indexes?: IndexDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type: "INTEGER" | "TEXT" | "REAL" | "BLOB" | "BOOLEAN" | "DATETIME" | "UUID";
  nullable?: boolean;
  defaultValue?: any;
  autoIncrement?: boolean;
  length?: number;
}

export interface ForeignKeyDefinition {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique?: boolean;
}
