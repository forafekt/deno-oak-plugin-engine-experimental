// engine/plugins/mysql/plugin.ts
/**
 * MySQL Database Plugin
 * Provides MySQL database connectivity for tenants
 */

import { Container } from "../../core/container.ts";
import { Plugin, PluginConfig } from "../../core/plugin-manager.ts";
import { Tenant, TenantManager } from "../../core/tenant-manager.ts";
import { DatabaseDriver } from "../../core/types.ts";
import { EventEmitter } from "../../modules/events.ts";
import { Logger } from "../../modules/logger.ts";
import { MySQLDriver } from "./driver.ts";

export const MySQLPlugin: Plugin = {
  name: "mysql",
  version: "1.0.0",
  description: "MySQL database driver",

  async init(container: Container, config: PluginConfig): Promise<void> {
    const logger = container.resolve<Logger>("logger");
    const events = container.resolve<EventEmitter>("events");

    logger.info("Initializing MySQL plugin");

    // Register factory for MySQL driver
    container.registerFactory("db.mysql", (c) => {
      const tenant = c.has("tenant") ? c.resolve<Tenant>("tenant") : null;
      
      if (!tenant) {
        throw new Error("MySQL driver requires tenant context");
      }

      const dbConfig = tenant.config.database;
      if (!dbConfig || dbConfig.type !== "mysql") {
        throw new Error("Tenant does not have MySQL configuration");
      }

      return new MySQLDriver(dbConfig.connection as string, logger);
    });

    // Listen for tenant initialization to set up DB
    events.on("tenant:initialized", async (data: any) => {
      const { tenant, container: tenantContainer } = data;
      
      if (tenant.config.database?.type === "mysql") {
        logger.debug(`Setting up MySQL for tenant: ${tenant.id}`);
        
        try {
          const driver = await tenantContainer.resolveAsync("db.mysql");
          await driver.connect();
          
          // Register as 'db' for easy access
          tenantContainer.register("db", driver);
          
          logger.info(`MySQL connected for tenant: ${tenant.id}`);
        } catch (error) {
          logger.error(`Failed to connect MySQL for tenant ${tenant.id}`, {
            error: error.message,
          });
        }
      }
    });
  },

  async shutdown(container: Container): Promise<void> {
    const logger = container.resolve<Logger>("logger");
    logger.info("Shutting down MySQL plugin");
    
    // Disconnect all tenant databases
    const tenantManager = container.resolve<TenantManager>("tenantManager");
    for (const tenant of tenantManager.listTenants()) {
      if (tenant.config.database?.type === "mysql") {
        const tenantContainer = tenantManager.getContainer(tenant.id);
        if (tenantContainer && tenantContainer.has("db")) {
          const driver = tenantContainer.resolve<DatabaseDriver>("db");
          await driver.disconnect();
        }
      }
    }
  },
};

export default MySQLPlugin;