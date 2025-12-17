import { UniversalQuery, WhereCondition } from "./types.ts";

// SQLTranslator.ts
export class SQLTranslator {
  private dbType: string;

  constructor(dbType: string) {
    this.dbType = dbType;
  }

  translateQuery(query: UniversalQuery): string {
    switch (query.type) {
      case "SELECT":
        return this.buildSelect(query);
      case "INSERT":
        return this.buildInsert(query);
      case "UPDATE":
        return this.buildUpdate(query);
      case "DELETE":
        return this.buildDelete(query);
      case "CREATE_TABLE":
        return this.buildCreateTable(query);
      case "DROP_TABLE":
        return this.buildDropTable(query);
      default:
        throw new Error(`Unsupported query type: ${query.type}`);
    }
  }

  private buildSelect(query: UniversalQuery): string {
    let sql = "SELECT ";
    sql += query.fields?.join(", ") || "*";
    sql += ` FROM ${this.escapeIdentifier(query.table)}`;

    if (query.joins) {
      sql += " " +
        query.joins.map((join) =>
          `${join.type} JOIN ${
            this.escapeIdentifier(join.table)
          } ON ${join.condition}`
        ).join(" ");
    }

    if (query.conditions && query.conditions.length > 0) {
      sql += " WHERE " + this.buildWhereClause(query.conditions);
    }

    if (query.orderBy && query.orderBy.length > 0) {
      sql += " ORDER BY " +
        query.orderBy.map((order) =>
          `${this.escapeIdentifier(order.field)} ${order.direction}`
        ).join(", ");
    }

    if (query.limit !== undefined) {
      sql += this.buildLimitClause(query.limit, query.offset);
    }

    return sql;
  }

  private buildInsert(query: UniversalQuery): string {
    if (!query.fields || !query.values) {
      throw new Error("INSERT query requires fields and values");
    }

    const fields = query.fields.map((f) => this.escapeIdentifier(f)).join(", ");
    const placeholders = query.values.map((_, i) => this.formatParameter(i))
      .join(", ");

    return `INSERT INTO ${
      this.escapeIdentifier(query.table)
    } (${fields}) VALUES (${placeholders})`;
  }

  private buildUpdate(query: UniversalQuery): string {
    if (!query.updateData) {
      throw new Error("UPDATE query requires updateData");
    }

    const setClauses = Object.keys(query.updateData).map((key, i) =>
      `${this.escapeIdentifier(key)} = ${this.formatParameter(i)}`
    ).join(", ");

    let sql = `UPDATE ${this.escapeIdentifier(query.table)} SET ${setClauses}`;

    if (query.conditions && query.conditions.length > 0) {
      sql += " WHERE " + this.buildWhereClause(query.conditions);
    }

    return sql;
  }

  private buildDelete(query: UniversalQuery): string {
    let sql = `DELETE FROM ${this.escapeIdentifier(query.table)}`;

    if (query.conditions && query.conditions.length > 0) {
      sql += " WHERE " + this.buildWhereClause(query.conditions);
    }

    return sql;
  }

  private buildCreateTable(query: UniversalQuery): string {
    if (!query.tableSchema) {
      throw new Error("CREATE_TABLE query requires tableSchema");
    }

    const columns = query.tableSchema.columns.map((col) => {
      let def = `${this.escapeIdentifier(col.name)} ${
        this.translateDataType(col.type)
      }`;

      if (col.length) {
        def += `(${col.length})`;
      }

      if (!col.nullable) {
        def += " NOT NULL";
      }

      if (col.autoIncrement) {
        def += this.getAutoIncrementSyntax();
      }

      if (col.defaultValue !== undefined) {
        def += ` DEFAULT ${this.formatValue(col.defaultValue)}`;
      }

      return def;
    }).join(", ");

    let sql = `CREATE TABLE ${this.escapeIdentifier(query.table)} (${columns}`;

    if (
      query.tableSchema.primaryKey && query.tableSchema.primaryKey.length > 0
    ) {
      const pkColumns = query.tableSchema.primaryKey.map((col) =>
        this.escapeIdentifier(col)
      ).join(", ");
      sql += `, PRIMARY KEY (${pkColumns})`;
    }

    sql += ")";

    return sql;
  }

  private buildDropTable(query: UniversalQuery): string {
    return `DROP TABLE ${this.escapeIdentifier(query.table)}`;
  }

  private buildWhereClause(conditions: WhereCondition[]): string {
    return conditions.map((condition, i) => {
      let clause = "";

      if (i > 0) {
        clause += ` ${condition.conjunction || "AND"} `;
      }

      clause += `${
        this.escapeIdentifier(condition.field)
      } ${condition.operator}`;

      if (
        condition.operator === "IS NULL" || condition.operator === "IS NOT NULL"
      ) {
        // No value needed
      } else if (
        condition.operator === "IN" || condition.operator === "NOT IN"
      ) {
        const values = Array.isArray(condition.value)
          ? condition.value
          : [condition.value];
        const placeholders = values.map((_, idx) =>
          this.formatParameter(i + idx)
        ).join(", ");
        clause += ` (${placeholders})`;
      } else {
        clause += ` ${this.formatParameter(i)}`;
      }

      return clause;
    }).join("");
  }

  private buildLimitClause(limit: number, offset?: number): string {
    switch (this.dbType) {
      case "mysql":
      case "postgresql":
      case "sqlite":
        let clause = ` LIMIT ${limit}`;
        if (offset !== undefined) {
          clause += ` OFFSET ${offset}`;
        }
        return clause;
      case "oracle":
        // Oracle uses ROWNUM or ROW_NUMBER()
        return offset
          ? ` OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`
          : ` FETCH FIRST ${limit} ROWS ONLY`;
      default:
        return ` LIMIT ${limit}`;
    }
  }

  private translateDataType(type: string): string {
    const typeMap: Record<string, Record<string, string>> = {
      mysql: {
        "INTEGER": "INT",
        "TEXT": "TEXT",
        "REAL": "DOUBLE",
        "BLOB": "BLOB",
        "BOOLEAN": "BOOLEAN",
        "DATETIME": "DATETIME",
        "UUID": "VARCHAR(36)",
      },
      postgresql: {
        "INTEGER": "INTEGER",
        "TEXT": "TEXT",
        "REAL": "REAL",
        "BLOB": "BYTEA",
        "BOOLEAN": "BOOLEAN",
        "DATETIME": "TIMESTAMP",
        "UUID": "UUID",
      },
      sqlite: {
        "INTEGER": "INTEGER",
        "TEXT": "TEXT",
        "REAL": "REAL",
        "BLOB": "BLOB",
        "BOOLEAN": "INTEGER",
        "DATETIME": "TEXT",
        "UUID": "TEXT",
      },
      oracle: {
        "INTEGER": "NUMBER",
        "TEXT": "CLOB",
        "REAL": "NUMBER",
        "BLOB": "BLOB",
        "BOOLEAN": "NUMBER(1)",
        "DATETIME": "TIMESTAMP",
        "UUID": "VARCHAR2(36)",
      },
    };

    return typeMap[this.dbType]?.[type] || type;
  }

  private getAutoIncrementSyntax(): string {
    switch (this.dbType) {
      case "mysql":
        return " AUTO_INCREMENT";
      case "postgresql":
        return " SERIAL";
      case "sqlite":
        return " AUTOINCREMENT";
      case "oracle":
        return " GENERATED BY DEFAULT AS IDENTITY";
      default:
        return "";
    }
  }

  formatParameter(index: number): string {
    switch (this.dbType) {
      case "mysql":
        return "?";
      case "postgresql":
        return `$${index + 1}`;
      case "sqlite":
        return "?";
      case "oracle":
        return `:${index + 1}`;
      default:
        return "?";
    }
  }

  private escapeIdentifier(identifier: string): string {
    switch (this.dbType) {
      case "mysql":
        return `\`${identifier}\``;
      case "postgresql":
        return `"${identifier}"`;
      case "sqlite":
        return `"${identifier}"`;
      case "oracle":
        return `"${identifier}"`;
      default:
        return identifier;
    }
  }

  private formatValue(value: any): string {
    if (value === null) return "NULL";
    if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    return String(value);
  }
}
