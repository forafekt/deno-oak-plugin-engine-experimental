// engine/plugins/sqlite/plugin.ts
/**
 * SQLite Database Plugin
 * Provides SQLite database connectivity for tenants
 */

import { Container } from "../../core/container.ts";
import { Plugin, PluginConfig } from "../../core/plugin-manager.ts";
import { Tenant, TenantManager } from "../../core/tenant-manager.ts";
import { DatabaseDriver } from "../../core/types.ts";
import { EventEmitter } from "../../modules/events.ts";
import { Logger } from "../../modules/logger.ts";
import { SQLiteDriver } from "./driver.ts";

export const SQLitePlugin: Plugin = {
  name: "sqlite",
  version: "1.0.0",
  description: "SQLite database driver",
  type: 'server',

  async init(container: Container, config: PluginConfig): Promise<void> {
    const logger = container.resolve<Logger>("logger");
    const events = container.resolve<EventEmitter>("events");

    logger.info("Initializing SQLite plugin");

    // Register factory for SQLite driver
    container.registerFactory("db.sqlite", (c) => {
      const tenant = c.has("tenantManager") ? c.resolve<TenantManager>("tenantManager").getTenant("my-tenant") : null;
      console.log(tenant);
      if (!tenant) {
        throw new Error("SQLite driver requires tenant context");
      }

      const dbConfig = tenant.config.database;
      if (!dbConfig || dbConfig.type !== "sqlite") {
        throw new Error("Tenant does not have SQLite configuration");
      }

      return new SQLiteDriver(dbConfig.connection as string, logger);
    });

    // Listen for tenant initialization
    events.on("tenant:initialized", async (data: any) => {
      const { tenant, container: tenantContainer } = data;
      
      if (tenant.config.database?.type === "sqlite") {
        logger.debug(`Setting up SQLite for tenant: ${tenant.id}`);
        
        try {
          const driver = await tenantContainer.resolveAsync("db.sqlite") as SQLiteDriver;
          await driver.connect();
          
          // Register as 'db' for easy access
          tenantContainer.register("db", driver);
          
          logger.info(`SQLite connected for tenant: ${tenant.id}`);
        } catch (error) {
          logger.error(`Failed to connect SQLite for tenant ${tenant.id}`, {
            error: error.message,
          });
        }
      }
    });
  },

  async shutdown(container: Container): Promise<void> {
    const logger = container.resolve<Logger>("logger");
    logger.info("Shutting down SQLite plugin");
    
    // Disconnect all tenant databases
    const tenantManager = container.resolve<TenantManager>("tenantManager");
    for (const tenant of tenantManager.listTenants()) {
      if (tenant.config.database?.type === "sqlite") {
        const tenantContainer = tenantManager.getContainer(tenant.id);
        if (tenantContainer && tenantContainer.has("db")) {
          const driver = tenantContainer.resolve<DatabaseDriver>("db");
          await driver.disconnect();
        }
      }
    }
  },
};

export default SQLitePlugin;