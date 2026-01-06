// adapters/mysql.ts
import { Client } from "@denoboot/x/mysql.ts";
import type {
  DataAccess,
  DatabaseAdapter,
  DatabaseConfig,
  TenantConfig,
} from "../types.ts";

export class MySQLAdapter implements DatabaseAdapter {
  private client: Client;
  private config: DatabaseConfig;
  private tablePrefix: string;

  constructor(config: DatabaseConfig, tablePrefix = "mt_") {
    this.config = config;
    this.tablePrefix = tablePrefix;
    this.client = new Client();
  }

  async connect(config: DatabaseConfig): Promise<void> {

    if (!config.database) {
      throw new Error("Config property 'database' is required");
    }

    await this.client.connect({
      hostname: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      db: config.database,
      poolSize: config.connectionLimit || 10,
      // acquireTimeout: config.acquireTimeout || 30000,
      timeout: config.timeout || 30000,
    });
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  async setupSchema(): Promise<void> {
    // Create tenants table
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}tenants (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        isolation_strategy ENUM('schema', 'database', 'prefix') NOT NULL,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create jobs table
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}jobs (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id VARCHAR(255),
        type VARCHAR(255) NOT NULL,
        payload JSON NOT NULL,
        priority INT DEFAULT 0,
        attempts INT DEFAULT 0,
        max_retries INT DEFAULT 3,
        scheduled_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        failed_at TIMESTAMP NULL,
        error TEXT NULL,
        INDEX idx_tenant_type (tenant_id, type),
        INDEX idx_scheduled_at (scheduled_at),
        INDEX idx_priority (priority DESC),
        FOREIGN KEY (tenant_id) REFERENCES ${this.tablePrefix}tenants(id) ON DELETE CASCADE
      )
    `);
  }

  async createTenant(tenant: TenantConfig): Promise<void> {
    const result = await this.client.execute(
      `INSERT INTO ${this.tablePrefix}tenants (id, name, isolation_strategy, metadata) VALUES (?, ?, ?, ?)`,
      [
        tenant.id,
        tenant.name,
        tenant.isolationStrategy,
        JSON.stringify(tenant.metadata || {}),
      ],
    );

    if (result.affectedRows === 0) {
      throw new Error(`Failed to create tenant: ${tenant.id}`);
    }

    // Setup tenant isolation
    await this.setupTenantIsolation(tenant);
  }

  async getTenant(id: string): Promise<TenantConfig | null> {
    const result = await this.client.query(
      `SELECT * FROM ${this.tablePrefix}tenants WHERE id = ?`,
      [id],
    );

    if (result.length === 0) {
      return null;
    }

    const row = result[0] as any;
    return {
      id: row.id,
      name: row.name,
      isolationStrategy: row.isolation_strategy,
      metadata: JSON.parse(row.metadata || "{}"),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async listTenants(): Promise<TenantConfig[]> {
    const result = await this.client.query(
      `SELECT * FROM ${this.tablePrefix}tenants ORDER BY created_at DESC`,
    );

    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      isolationStrategy: row.isolation_strategy,
      metadata: JSON.parse(row.metadata || "{}"),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  async updateTenant(
    id: string,
    updates: Partial<TenantConfig>,
  ): Promise<void> {
    const setClause = [];
    const values = [];

    if (updates.name) {
      setClause.push("name = ?");
      values.push(updates.name);
    }

    if (updates.metadata) {
      setClause.push("metadata = ?");
      values.push(JSON.stringify(updates.metadata));
    }

    if (setClause.length === 0) {
      return;
    }

    values.push(id);

    const result = await this.client.execute(
      `UPDATE ${this.tablePrefix}tenants SET ${
        setClause.join(", ")
      } WHERE id = ?`,
      values,
    );

    if (result.affectedRows === 0) {
      throw new Error(`Tenant not found: ${id}`);
    }
  }

  async deleteTenant(id: string): Promise<void> {
    const tenant = await this.getTenant(id);
    if (!tenant) {
      throw new Error(`Tenant not found: ${id}`);
    }

    // Clean up tenant isolation
    await this.cleanupTenantIsolation(tenant);

    const result = await this.client.execute(
      `DELETE FROM ${this.tablePrefix}tenants WHERE id = ?`,
      [id],
    );

    if (result.affectedRows === 0) {
      throw new Error(`Failed to delete tenant: ${id}`);
    }
  }

  getDataAccess(tenantId?: string): DataAccess {
    return new MySQLDataAccess(this.client, tenantId, this.tablePrefix);
  }

  async cleanup(): Promise<void> {
    // Clean up old completed jobs
    await this.client.execute(`
      DELETE FROM ${this.tablePrefix}jobs 
      WHERE completed_at IS NOT NULL 
      AND completed_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    // Clean up old failed jobs
    await this.client.execute(`
      DELETE FROM ${this.tablePrefix}jobs 
      WHERE failed_at IS NOT NULL 
      AND failed_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
  }

  private async setupTenantIsolation(tenant: TenantConfig): Promise<void> {
    switch (tenant.isolationStrategy) {
      case "schema":
        await this.client.execute(
          `CREATE SCHEMA IF NOT EXISTS tenant_${tenant.id}`,
        );
        break;
      case "database":
        await this.client.execute(
          `CREATE DATABASE IF NOT EXISTS tenant_${tenant.id}`,
        );
        break;
      case "prefix":
        // No additional setup needed for prefix strategy
        break;
    }
  }

  public getIsolationStrategyDroppers(tenant: TenantConfig) {
     const strategies = {
      schema: async () => {
                await this.client.execute(`DROP SCHEMA IF EXISTS tenant_${tenant.id}`);
      },
      database: async () => {
              await this.client.execute(
          `DROP DATABASE IF EXISTS tenant_${tenant.id}`,
        );
      },
      prefix: async () => {
         // Clean up all tables with tenant prefix
        const tables = await this.client.query(
          `
          SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE ?
        `,
          [this.config.database, `tenant_${tenant.id}_%`],
        );

        const tableNames = tables.map((table: Record<string, string>) => table.TABLE_NAME);
        for (const tableName of tableNames) {
          await this.client.execute(
            `DROP TABLE IF EXISTS ${tableName}`,
          );
        }
      }
    }
    return strategies;
  }

  private async cleanupTenantIsolation(tenant: TenantConfig): Promise<void> {
    const strategies = this.getIsolationStrategyDroppers(tenant);
    switch (tenant.isolationStrategy) {
      case "schema":
        await strategies.schema();
        break;
      case "database":
        await strategies.database();
        break;
      case "prefix":
        await strategies.prefix();
        break;
    }
  }
}

class MySQLDataAccess implements DataAccess {
  constructor(
    private client: Client,
    private tenantId?: string,
    private tablePrefix: string = "mt_",
  ) {}

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const modifiedSql = this.modifySqlForTenant(sql);
    return await this.client.query(modifiedSql, params) as T[];
  }

  async execute(
    sql: string,
    params?: any[],
  ) {
    const modifiedSql = this.modifySqlForTenant(sql);
    const result = await this.client.execute(modifiedSql, params);
    return {
      affectedRows: result.affectedRows || 0,
      insertId: result.lastInsertId || undefined,
    };
  }

  async transaction<T>(fn: (tx: DataAccess) => Promise<T>): Promise<T> {
    await this.client.execute("START TRANSACTION");

    try {
      const result = await fn(this);
      await this.client.execute("COMMIT");
      return result;
    } catch (error) {
      await this.client.execute("ROLLBACK");
      throw error;
    }
  }

  private modifySqlForTenant(sql: string): string {
    if (!this.tenantId) {
      return sql;
    }

    // This is a simplified implementation - in production, you'd want
    // more sophisticated SQL parsing and modification
    return sql.replace(
      /\b(\w+)\b/g,
      (match, tableName) => {
        if (tableName.startsWith(this.tablePrefix)) {
          return `tenant_${this.tenantId}_${tableName}`;
        }
        return match;
      },
    );
  }
}
