# Tenant Database Engine (TDBE)

This package is a database engine for tenant databases.

```typescript
import {
  createMySQLEngine,
  engineBuilder,
  type JobContext,
  type JobHandler,
  MultiTenantEngine,
  type Plugin,
} from "tenant-database-engine/mod.ts";

// Basic Usage Example
async function basicUsage() {
  // Create engine with factory function
  const engine = createMySQLEngine({
    database: {
      host: "localhost",
      port: 3306,
      username: "root",
      password: "password",
      database: "multitenant_db",
    },
    worker: {
      concurrency: 10,
      pollInterval: 2000,
    },
    defaultIsolationStrategy: "prefix",
    tablePrefix: "mt_",
  });

  // Initialize the engine
  await engine.initialize();

  // Create a tenant
  const tenant = await engine.createTenant(
    "tenant_1",
    "Company A",
    "prefix",
  );

  console.log("Created tenant:", tenant);

  // Get tenant-specific data access
  const dataAccess = engine.getDataAccess(tenant.id);

  // Create a table for this tenant
  await dataAccess.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

  // Insert data
  await dataAccess.execute(
    "INSERT INTO users (name, email) VALUES (?, ?)",
    ["John Doe", "john@example.com"],
  );

  // Query data
  const users = await dataAccess.query("SELECT * FROM users");
  console.log("Tenant users:", users);

  // Add a background job
  await engine.addJob("send_email", {
    to: "john@example.com",
    subject: "Welcome!",
    body: "Welcome to our platform!",
  }, {
    tenantId: tenant.id,
    priority: 1,
  });

  // Shutdown
  await engine.shutdown();
}

// Builder Pattern Example
async function builderUsage() {
  const engine = engineBuilder()
    .database({
      host: "localhost",
      port: 3306,
      username: "root",
      password: "password",
      database: "multitenant_db",
    })
    .worker({
      concurrency: 5,
      maxRetries: 5,
      retryDelay: 2000,
    })
    .defaultIsolationStrategy("schema")
    .tablePrefix("app_")
    .buildMySQL();

  await engine.initialize();

  // Use the engine...

  await engine.shutdown();
}

// Job Handler Examples
const emailHandler: JobHandler<{
  to: string;
  subject: string;
  body: string;
}> = async (payload, context: JobContext) => {
  console.log(`Sending email to ${payload.to} for tenant ${context.tenantId}`);

  // Access tenant-specific data
  const users = await context.dataAccess.query(
    "SELECT * FROM users WHERE email = ?",
    [payload.to],
  );

  // Simulate email sending
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log(`Email sent to ${payload.to}`);
};

const reportHandler: JobHandler<{
  type: "daily" | "weekly" | "monthly";
  format: "pdf" | "csv";
}> = async (payload, context: JobContext) => {
  console.log(`Generating ${payload.type} report in ${payload.format} format`);

  // Generate report using tenant data
  const data = await context.dataAccess.query("SELECT * FROM analytics");

  // Process report...
  console.log(`Report generated for tenant ${context.tenantId}`);
};

// Plugin Example: Audit Trail
class AuditPlugin implements Plugin {
  name = "audit-trail";
  version = "1.0.0";

  private engine?: MultiTenantEngine;

  async install(engine: MultiTenantEngine): Promise<void> {
    this.engine = engine;

    // Setup audit table
    const dataAccess = engine.getDataAccess();
    await dataAccess.execute(`
        CREATE TABLE IF NOT EXISTS mt_audit_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id VARCHAR(255),
          action VARCHAR(100) NOT NULL,
          entity_type VARCHAR(100),
          entity_id VARCHAR(255),
          changes JSON,
          user_id VARCHAR(255),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_tenant_timestamp (tenant_id, timestamp)
        )
      `);

    console.log("Audit plugin installed");
  }

  async uninstall(engine: MultiTenantEngine): Promise<void> {
    // Clean up if needed
    console.log("Audit plugin uninstalled");
  }

  async logAction(
    tenantId: string,
    action: string,
    entityType: string,
    entityId: string,
    changes: Record<string, any>,
    userId?: string,
  ): Promise<void> {
    if (!this.engine) {
      throw new Error("Plugin not installed");
    }

    const dataAccess = this.engine.getDataAccess();
    await dataAccess.execute(
      `
        INSERT INTO mt_audit_log 
        (tenant_id, action, entity_type, entity_id, changes, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        tenantId,
        action,
        entityType,
        entityId,
        JSON.stringify(changes),
        userId || null,
      ],
    );
  }

  async getAuditLog(tenantId: string, limit = 100): Promise<any[]> {
    if (!this.engine) {
      throw new Error("Plugin not installed");
    }

    const dataAccess = this.engine.getDataAccess();
    return await dataAccess.query(
      `
        SELECT * FROM mt_audit_log 
        WHERE tenant_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `,
      [tenantId, limit],
    );
  }
}

// Complete Example with Plugin
async function completeExample() {
  const engine = createMySQLEngine({
    database: {
      host: "localhost",
      port: 3306,
      username: "root",
      password: "password",
      database: "multitenant_db",
    },
    worker: {
      concurrency: 3,
      pollInterval: 1000,
    },
    defaultIsolationStrategy: "prefix",
  });

  await engine.initialize();

  // Register job handlers
  engine.registerJobHandler("send_email", emailHandler);
  engine.registerJobHandler("generate_report", reportHandler);

  // Install audit plugin
  const auditPlugin = new AuditPlugin();
  await engine.installPlugin(auditPlugin);

  // Create tenants
  const tenant1 = await engine.createTenant("acme_corp", "ACME Corporation");
  const tenant2 = await engine.createTenant("globex", "Globex Industries");

  // Setup tenant data
  await engine.withTenant(tenant1.id, async (dataAccess) => {
    await dataAccess.execute(`
        CREATE TABLE IF NOT EXISTS products (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          price DECIMAL(10,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

    await dataAccess.execute(
      "INSERT INTO products (name, price) VALUES (?, ?)",
      ["Widget A", 29.99],
    );

    // Log the action
    await auditPlugin.logAction(
      tenant1.id,
      "CREATE",
      "product",
      "1",
      { name: "Widget A", price: 29.99 },
      "user123",
    );
  });

  // Add jobs for different tenants
  await engine.addJob("send_email", {
    to: "admin@acme.com",
    subject: "New Product Added",
    body: "Widget A has been added to your inventory.",
  }, { tenantId: tenant1.id });

  await engine.addJob("generate_report", {
    type: "daily",
    format: "pdf",
  }, { tenantId: tenant2.id });

  // Health check
  const health = await engine.healthCheck();
  console.log("Health status:", health);

  // Wait a bit for jobs to process
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // View audit log
  const auditLog = await auditPlugin.getAuditLog(tenant1.id);
  console.log("Audit log for tenant1:", auditLog);

  await engine.shutdown();
}

// Error Handling Example
async function errorHandlingExample() {
  const engine = createMySQLEngine({
    database: {
      host: "localhost",
      port: 3306,
      username: "root",
      password: "password",
      database: "multitenant_db",
    },
  });

  try {
    await engine.initialize();

    // This will fail if tenant doesn't exist
    await engine.withTenant("nonexistent", async (dataAccess) => {
      await dataAccess.query("SELECT 1");
    });
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await engine.shutdown();
  }
}

// Export examples for use
export {
  AuditPlugin,
  basicUsage,
  builderUsage,
  completeExample,
  emailHandler,
  errorHandlingExample,
  reportHandler,
};

```