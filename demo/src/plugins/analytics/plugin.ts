// example-app/plugins/analytics/plugin.ts
/**
 * Analytics Plugin
 * Provides event tracking and analytics
 */

import { Plugin, Container, PluginConfig, Logger, WorkerManager, CacheDriver, DatabaseDriver } from "@denoboot/engine/mod.ts";

export const AnalyticsPlugin: Plugin = {
  name: "analytics",
  version: "1.0.0",
  description: "Analytics and event tracking",
  type: 'server',

  async init(container: Container, config: PluginConfig): Promise<void> {
    const logger = container.resolve<Logger>("logger");
    logger.info("Initializing analytics plugin");

    // Register analytics service
    container.registerSingleton("analytics", async (c) => {
      return new AnalyticsService(c);
    });
  },

  routes: [
    {
      method: "POST",
      path: "/api/analytics/track",
      tenant: true,
      handler: async (ctx, container) => {
        const analytics = await container.resolveAsync<AnalyticsService>("analytics");
        const body = await ctx.request.body({ type: "json" }).value;

        // Dispatch tracking worker
        const workers = container.resolve<WorkerManager>("workers");
        const jobId = await workers.dispatch(
          "analytics",
          "track-event",
          {
            tenantId: ctx.state.tenant.id,
            data: {
              ...body,
              timestamp: new Date().toISOString(),
              ip: ctx.request.ip,
              userAgent: ctx.request.headers.get("user-agent"),
            },
          },
          container.getParent() || container
        );

        ctx.response.body = {
          success: true,
          jobId,
        };
      },
    },
    {
      method: "GET",
      path: "/api/analytics/stats",
      tenant: true,
      handler: async (ctx, container) => {
        const analytics = await container.resolveAsync<AnalyticsService>("analytics");
        const stats = await analytics.getStats();

        ctx.response.body = stats;
      },
    },
    {
      method: "GET",
      path: "/api/analytics/events",
      tenant: true,
      handler: async (ctx, container) => {
        const analytics = await container.resolveAsync<AnalyticsService>("analytics");
        const limit = parseInt(ctx.request.url.searchParams.get("limit") || "100");
        const events = await analytics.getEvents(limit);

        ctx.response.body = { events };
      },
    },
  ],

  workers: [
    {
      name: "track-event",
      handler: async (payload, container) => {
        const logger = container.resolve<Logger>("logger");
        const analytics = await container.resolveAsync<AnalyticsService>("analytics");

        logger.debug("Tracking analytics event", {
          tenantId: payload.tenantId,
          event: payload.data.event,
        });

        await analytics.storeEvent(payload.data);

        return {
          success: true,
          data: { tracked: true },
        };
      },
    },
    {
      name: "aggregate-stats",
      handler: async (payload, container) => {
        const logger = container.resolve<Logger>("logger");
        const analytics = await container.resolveAsync<AnalyticsService>("analytics");

        logger.debug("Aggregating analytics stats");

        await analytics.aggregateStats();

        return {
          success: true,
          data: { aggregated: true },
        };
      },
    },
  ],

  middleware: [
    async (ctx, next) => {
      // Auto-track page views
      if (ctx.state.tenant && ctx.request.method === "GET") {
        const container = ctx.state.container;
        const workers = container.resolve("workers") as WorkerManager;

        await workers.dispatch(
          "analytics",
          "track-event",
          {
            tenantId: ctx.state.tenant.id,
            data: {
              event: "page_view",
              path: ctx.request.url.pathname,
              timestamp: new Date().toISOString(),
            },
          },
          container.getParent() || container
        );
      }

      await next();
    },
  ],
};

class AnalyticsService {
  private container: Container;
  private events: any[] = [];

  constructor(container: Container) {
    this.container = container;
  }

  async storeEvent(event: any): Promise<void> {
    // Try to use cache for recent events
    if (this.container.has("cache")) {
      const cache = this.container.resolve<CacheDriver>("cache");
      const key = `event:${event.timestamp}:${Math.random()}`;
      await cache.set(key, event, 3600); // 1 hour TTL
    }

    // Store in database
    const db = this.container.resolve<DatabaseDriver>("db");

    try {
      await db.execute(
        "INSERT INTO analytics_events (event, data, timestamp) VALUES (?, ?, ?)",
        [event.event, JSON.stringify(event), event.timestamp]
      );
    } catch {
      // Fallback to in-memory
      this.events.push(event);
      if (this.events.length > 1000) {
        this.events.shift(); // Keep only last 1000
      }
    }
  }

  async getEvents(limit = 100): Promise<any[]> {
    const db = this.container.resolve<DatabaseDriver>("db");

    try {
      return await db.query(
        "SELECT * FROM analytics_events ORDER BY timestamp DESC LIMIT ?",
        [limit]
      );
    } catch {
      return this.events.slice(0, limit);
    }
  }

  async getStats(): Promise<any> {
    const events = await this.getEvents(1000);

    const stats = {
      total: events.length,
      byEvent: {} as Record<string, number>,
      byDay: {} as Record<string, number>,
    };

    for (const event of events) {
      // Count by event type
      const eventType = event.event || "unknown";
      stats.byEvent[eventType] = (stats.byEvent[eventType] || 0) + 1;

      // Count by day
      const day = new Date(event.timestamp).toISOString().split("T")[0];
      stats.byDay[day] = (stats.byDay[day] || 0) + 1;
    }

    return stats;
  }

  async aggregateStats(): Promise<void> {
    const logger = this.container.resolve<Logger>("logger");
    logger.debug("Aggregating analytics stats...");

    const stats = await this.getStats();

    // Store aggregated stats
    if (this.container.has("cache")) {
      const cache = this.container.resolve<CacheDriver>("cache");
      await cache.set("analytics:stats", stats, 300); // 5 min cache
    }
  }
}

export default AnalyticsPlugin;