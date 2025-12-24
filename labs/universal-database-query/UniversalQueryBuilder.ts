import { SQLTranslator } from "./SQLTranslator.ts";
import {
  JoinClause,
  TableSchema,
  UniversalQuery,
  WhereCondition,
} from "./types.ts";

// Universal Query Builder
export class UniversalQueryBuilder {
  private query: UniversalQuery;
  private params: any[] = [];

  constructor() {
    this.query = { type: "SELECT", table: "" };
  }

  select(fields?: string[]): this {
    this.query.type = "SELECT";
    this.query.fields = fields;
    return this;
  }

  from(table: string): this {
    this.query.table = table;
    return this;
  }

  where(
    field: string,
    operator: WhereCondition["operator"],
    value?: any,
  ): this {
    if (!this.query.conditions) {
      this.query.conditions = [];
    }

    this.query.conditions.push({ field, operator, value });
    if (
      value !== undefined && operator !== "IS NULL" &&
      operator !== "IS NOT NULL"
    ) {
      this.params.push(value);
    }
    return this;
  }

  and(field: string, operator: WhereCondition["operator"], value?: any): this {
    if (!this.query.conditions) {
      this.query.conditions = [];
    }

    this.query.conditions.push({ field, operator, value, conjunction: "AND" });
    if (
      value !== undefined && operator !== "IS NULL" &&
      operator !== "IS NOT NULL"
    ) {
      this.params.push(value);
    }
    return this;
  }

  or(field: string, operator: WhereCondition["operator"], value?: any): this {
    if (!this.query.conditions) {
      this.query.conditions = [];
    }

    this.query.conditions.push({ field, operator, value, conjunction: "OR" });
    if (
      value !== undefined && operator !== "IS NULL" &&
      operator !== "IS NOT NULL"
    ) {
      this.params.push(value);
    }
    return this;
  }

  join(
    table: string,
    condition: string,
    type: JoinClause["type"] = "INNER",
  ): this {
    if (!this.query.joins) {
      this.query.joins = [];
    }

    this.query.joins.push({ type, table, condition });
    return this;
  }

  orderBy(field: string, direction: "ASC" | "DESC" = "ASC"): this {
    if (!this.query.orderBy) {
      this.query.orderBy = [];
    }

    this.query.orderBy.push({ field, direction });
    return this;
  }

  limit(count: number): this {
    this.query.limit = count;
    return this;
  }

  offset(count: number): this {
    this.query.offset = count;
    return this;
  }

  insertInto(table: string, data: Record<string, any>): this {
    this.query.type = "INSERT";
    this.query.table = table;
    this.query.fields = Object.keys(data);
    this.query.values = Object.values(data);
    this.params = Object.values(data);
    return this;
  }

  update(table: string, data: Record<string, any>): this {
    this.query.type = "UPDATE";
    this.query.table = table;
    this.query.updateData = data;
    this.params = Object.values(data);
    return this;
  }

  deleteFrom(table: string): this {
    this.query.type = "DELETE";
    this.query.table = table;
    return this;
  }

  createTable(table: string, schema: TableSchema): this {
    this.query.type = "CREATE_TABLE";
    this.query.table = table;
    this.query.tableSchema = schema;
    return this;
  }

  dropTable(table: string): this {
    this.query.type = "DROP_TABLE";
    this.query.table = table;
    return this;
  }

  build(): { query: UniversalQuery; params: any[]; sql: string } {
    return { query: this.query, params: this.params, sql: this.toSQL() };
  }

  toSQL(): string {
    const translator = new SQLTranslator(this.query.type);
    return translator.translateQuery(this.query);
  }
}
