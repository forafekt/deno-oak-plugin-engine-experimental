// engine/plugins/dashboard/plugin.ts
/**
 * Dashboard Plugin
 * Complete dashboard implementation
 */

import {
  Plugin,
  Container,
  PluginConfig,
  ViewEngine,
  Logger,
  EventEmitter,
} from "../../../engine/mod.ts";

export const DashboardPlugin: Plugin = {
  name: "dashboard",
  version: "1.0.0",
  description: "Dashboard plugin",

  async init(container: Container, config: PluginConfig): Promise<void> {
    const logger = container.resolve<Logger>("logger");
    const events = container.resolve<EventEmitter>("events");

    logger.info("Initializing dashboard plugin");

    // Register dashboard service factory for each tenant
    container.registerFactory("dashboard", (c) => {
      return new DashboardService(c);
    });

    // Listen for tenant initialization
    events.on("tenant:initialized", async (data: any) => {
      const { tenant, container: tenantContainer } = data;

      if (tenant.plugins.includes("dashboard")) {
        logger.debug(`Setting up dashboard for tenant: ${tenant.id}`);

        // Initialize dashboard service
        const dashboard = tenantContainer.resolve("dashboard");
        await dashboard.initialize();
      }
    });
  },

  routes: [
    {
      method: "GET",
      path: "/dashboard",
      tenant: true,
      handler: async (ctx, container) => {
        const dashboard = container.resolve<DashboardService>("dashboard");

        // if (!post) {
        //   ctx.response.status = 404;
        //   ctx.response.body = { error: "Post not found" };
        //   return;
        // }

        const views = container.resolve<ViewEngine>("views");
        const html = await views.render(
          "dashboard",
          {
            title: "Dashboard",
            tenant: ctx.state.tenant,
          },
          {
            plugin: "dashboard",
          }
        );

        ctx.response.type = "text/html";
        ctx.response.body = html;
      },
    },
    {
      method: "GET",
      path: "/tenant/:tenantId/dashboard",
      tenant: true,
      name: "tenant-dashboard",
      handler: async (ctx, container) => {
        const tenant = ctx.state.tenant;
        const views = container.resolve<ViewEngine>("views");

        const html = await views.render(
          'dashboard',
          {
            tenant,
            title: `${tenant.name} Dashboard`,
            assets: {
                'dashboard.css': "/@fs/css/plugins/dashboard/dashboard.css",
                'dashboard.js': "/@fs/js/plugins/dashboard/scripts/dashboard.js",
            },
          },
          {
            tenant,
            plugin: "dashboard",
          }
        );

        ctx.response.type = "text/html";
        ctx.response.body = html;
      },
    },
  ],

  workers: [],

  viewPaths: ["../engine/plugins/dashboard/views"],
};

/**
 * Dashboard Service
 */
class DashboardService {
  private container: Container;
  private posts: Map<string, any> = new Map();
  private initialized = false;

  constructor(container: Container) {
    this.container = container;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const logger = this.container.resolve<Logger>("logger");
    logger.debug("Initializing dashboard service");

    this.initialized = true;
  }
}

export default DashboardPlugin;
