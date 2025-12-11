// main.ts
/**
 * Example Cortex Application
 * Demonstrates how to use the Cortex Engine in a real project
 */

import { bootstrap, CortexRouter, Logger, PluginManager, TenantManager, ViewEngine, WorkerManager, DefaultTenantResolver } from "../engine/mod.ts";
import MySQLPlugin from "../engine/plugins/mysql/plugin.ts";
import SQLitePlugin from "../engine/plugins/sqlite/plugin.ts";
import DenoKVPlugin from "../engine/plugins/denokv/plugin.ts";
import { BlogPlugin } from "./plugins/blog/plugin.ts";
import { AnalyticsPlugin } from "./plugins/analytics/plugin.ts";

// Custom middleware
const corsMiddleware = async (ctx: any, next: any) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  await next();
};

(async () => {
    // Bootstrap the engine
const engine = await bootstrap({
  config: "cfg.ts",
  plugins: [
    MySQLPlugin,
    SQLitePlugin,
    DenoKVPlugin,
    BlogPlugin,
    AnalyticsPlugin,
  ],
  tenantsFile: "./tenants.json",
  middleware: [corsMiddleware],
  tenantResolver: new DefaultTenantResolver(),
});


// Add custom routes
const container = engine.getContainer();
const router = container.resolve<CortexRouter>("router");

router.register({
  method: "GET",
  path: "/",
  tenant: false,
  handler: async (ctx) => {
    const views = container.resolve<ViewEngine>("views");
    const html = await views.render("home", {
      title: "Cortex Engine",
      description: "Multi-tenant plugin framework for Deno",
    });
    ctx.response.type = "text/html";
    ctx.response.body = html;
  },
});

router.register({
  method: "GET",
  path: "/health",
  tenant: false,
  handler: (ctx) => {
    const tenantManager = container.resolve<TenantManager>("tenantManager");
    const plugins = container.resolve<PluginManager>("plugins");
    const workers = container.resolve<WorkerManager>("workers");

    ctx.response.body = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      stats: {
        tenants: tenantManager.listTenants().length,
        plugins: plugins.list().length,
        workers: workers.getStats(),
      },
    };
  },
});

router.register({
  method: "GET",
  path: "/api/tenants",
  tenant: false,
  handler: (ctx) => {
    const tenantManager = container.resolve<TenantManager>("tenantManager");
    const tenants = tenantManager.listTenants().map((t) => ({
      id: t.id,
      name: t.name,
      domain: t.domain,
      subdomain: t.subdomain,
      plugins: t.plugins,
    }));

    ctx.response.body = { tenants };
  },
});

// Tenant-specific dashboard
router.register({
  method: "GET",
  path: "/dashboard",
  tenant: true,
  handler: async (ctx, container) => {
    const tenant = await container.resolve<TenantManager>("tenantManager").resolve(ctx);
    const views = container.resolve<ViewEngine>("views");
    
    const html = await views.render("dashboard", {
      tenant,
      title: `${tenant.name} Dashboard`,
    });
    
    ctx.response.type = "text/html";
    ctx.response.body = html;
  },
});

// Example worker dispatch endpoint
router.register({
  method: "POST",
  path: "/api/dispatch/:plugin/:worker",
  tenant: true,
  handler: async (ctx, container) => {
    const plugin = ctx.params.plugin;
    const worker = ctx.params.worker;
    const tenant = ctx.state.tenant;
    
    const body = await ctx.request.body({ type: "json" }).value;
    
    const workers = container.resolve<WorkerManager>("workers");
    const jobId = await workers.dispatch(
      plugin,
      worker,
      {
        tenantId: tenant.id,
        data: body,
      },
      container.getParent() || container
    );
    
    ctx.response.body = {
      success: true,
      jobId,
      message: "Worker dispatched",
    };
  },
});

// Worker status endpoint
router.register({
  method: "GET",
  path: "/api/workers/stats",
  tenant: false,
  handler: (ctx) => {
    const workers = container.resolve<WorkerManager>("workers");
    ctx.response.body = workers.getStats();
  },
});

router.register({
  method: "GET",
  path: "/api/workers/:jobId",
  tenant: false,
  handler: (ctx) => {
    const workers = container.resolve<WorkerManager>("workers");
    const job = workers.getJob(ctx.params.jobId);
    
    if (!job) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Job not found" };
      return;
    }
    
    ctx.response.body = job;
  },
});

// Graceful shutdown
const shutdown = async () => {
  const logger = container.resolve<Logger>("logger");
  logger.info("Received shutdown signal");
  
  await engine.shutdown();
  Deno.exit(0);
};

Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

// Start the server
console.log("\n🚀 Cortex Engine Example Application\n");
console.log("   📝 Documentation: See README.md");
console.log("   🔌 Plugins loaded:");
container.resolve<PluginManager>("plugins").list().forEach((name: string) => {
  console.log(`      - ${name}`);
});
console.log("   🏢 Tenants registered:");
container.resolve<TenantManager>("tenantManager").listTenants().forEach((t) => {
  console.log(`      - ${t.id} (${t.name})`);
});
console.log("\n   Press Ctrl+C to stop\n");

engine.listen();
})()