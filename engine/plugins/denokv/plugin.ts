// engine/plugins/denokv/plugin.ts
/**
 * Deno KV Plugin
 * Provides Deno KV for database and cache functionality
 */

import { Container, Plugin, PluginConfig } from "../../core/types.ts";
import { DenoKVDriver } from "./driver.ts";

export const DenoKVPlugin: Plugin = {
  name: "denokv",
  version: "1.0.0",
  description: "Deno KV database and cache driver",

  async init(container: Container, config: PluginConfig): Promise<void> {
    const logger = container.resolve("logger");
    const events = container.resolve("events");

    logger.info("Initializing Deno KV plugin");

    // Register factory for Deno KV driver (database)
    container.registerFactory("db.denokv", (c) => {
      const tenant = c.has("tenant") ? c.resolve("tenant") : null;
      
      if (!tenant) {
        throw new Error("DenoKV driver requires tenant context");
      }

      const dbConfig = tenant.config.database;
      if (!dbConfig || dbConfig.type !== "denokv") {
        throw new Error("Tenant does not have DenoKV configuration");
      }

      const path = typeof dbConfig.connection === "string" 
        ? dbConfig.connection 
        : undefined;
      
      return new DenoKVDriver(path, logger, tenant.id);
    });

    // Register factory for Deno KV cache
    container.registerFactory("cache.denokv", (c) => {
      const tenant = c.has("tenant") ? c.resolve("tenant") : null;
      
      if (!tenant) {
        throw new Error("DenoKV cache requires tenant context");
      }

      const cacheConfig = tenant.config.cache;
      if (!cacheConfig || cacheConfig.type !== "denokv") {
        throw new Error("Tenant does not have DenoKV cache configuration");
      }

      const path = typeof cacheConfig.connection === "string" 
        ? cacheConfig.connection 
        : undefined;
      
      return new DenoKVDriver(path, logger, tenant.id);
    });

    // Listen for tenant initialization
    events.on("tenant:initialized", async (data: any) => {
      const { tenant, container: tenantContainer } = data;
      
      // Setup database
      if (tenant.config.database?.type === "denokv") {
        logger.debug(`Setting up Deno KV database for tenant: ${tenant.id}`);
        
        try {
          const driver = await tenantContainer.resolveAsync("db.denokv");
          await driver.connect();
          tenantContainer.register("db", driver);
          logger.info(`Deno KV database connected for tenant: ${tenant.id}`);
        } catch (error) {
          logger.error(`Failed to connect Deno KV database for tenant ${tenant.id}`, {
            error: error.message,
          });
        }
      }

      // Setup cache
      if (tenant.config.cache?.type === "denokv") {
        logger.debug(`Setting up Deno KV cache for tenant: ${tenant.id}`);
        
        try {
          const cache = await tenantContainer.resolveAsync("cache.denokv");
          await cache.connect();
          tenantContainer.register("cache", cache);
          logger.info(`Deno KV cache connected for tenant: ${tenant.id}`);
        } catch (error) {
          logger.error(`Failed to connect Deno KV cache for tenant ${tenant.id}`, {
            error: error.message,
          });
        }
      }
    });
  },

  async shutdown(container: Container): Promise<void> {
    const logger = container.resolve("logger");
    logger.info("Shutting down Deno KV plugin");
    
    // Disconnect all tenant KV instances
    const tenantManager = container.resolve("tenantManager");
    for (const tenant of tenantManager.listTenants()) {
      const tenantContainer = tenantManager.getContainer(tenant.id);
      if (!tenantContainer) continue;

      if (tenant.config.database?.type === "denokv" && tenantContainer.has("db")) {
        const driver = tenantContainer.resolve("db");
        await driver.disconnect();
      }

      if (tenant.config.cache?.type === "denokv" && tenantContainer.has("cache")) {
        const cache = tenantContainer.resolve("cache");
        await cache.disconnect();
      }
    }
  },
};

export default DenoKVPlugin;