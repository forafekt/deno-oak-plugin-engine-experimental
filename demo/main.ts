// example-app/main.ts
/**
 * Example OakSeed Application - FIXED VERSION
 * Demonstrates proper tenant routing setup with debugging
 */

import { bootstrap, OakSeedRouter, Logger, PluginManager, TenantManager, ViewEngine, WorkerManager } from "@oakseed/engine/mod.ts";


// Bootstrap the engine
// console.log("\n🚀 Bootstrapping OakSeed Engine...\n");

const engine = await bootstrap();

// engine.getContainer().resolve<OakSeedRouter>("router").printRoutes();

// Get services
const container = engine.getContainer();
const router = container.resolve<OakSeedRouter>("router");
const tenantManager = container.resolve<TenantManager>("tenantManager");

// Add custom global routes
// console.log("📝 Registering custom routes...\n");

router.register({
  method: "GET",
  path: "/",
  tenant: false,
  name: "home",
  handler: async (ctx) => {
    const views = container.resolve<ViewEngine>("views");
    const html = await views.render("home", {
      title: "OakSeed Engine",
      description: "Multi-tenant plugin framework for Deno",
    });
    ctx.response.type = "text/html";
    ctx.response.body = html;
  },
});

// router.register({
//   method: "GET",
//   path: "/health",
//   tenant: false,
//   name: "health",
//   handler: (ctx) => {
//     const workers = container.resolve<WorkerManager>("workers");

//     ctx.response.body = {
//       status: "healthy",
//       timestamp: new Date().toISOString(),
//       stats: {
//         tenants: tenantManager.listTenants().length,
//         plugins: container.resolve<PluginManager>("plugins").list().length,
//         workers: workers.getStats(),
//       },
//     };
//   },
// });

// router.register({
//   method: "GET",
//   path: "/api/tenants",
//   tenant: false,
//   name: "list-tenants",
//   handler: (ctx) => {
//     const tenants = tenantManager.listTenants().map((t) => ({
//       id: t.id,
//       name: t.name,
//       domain: t.domain,
//       subdomain: t.subdomain,
//       plugins: t.plugins,
//       enabled: t.enabled !== false,
//     }));

//     ctx.response.body = { tenants };
//   },
// });


// // Worker dispatch endpoint
// router.register({
//   method: "POST",
//   path: "/api/dispatch/:plugin/:worker",
//   tenant: true,
//   name: "dispatch-worker",
//   handler: async (ctx, container) => {
//     const plugin = ctx.params.plugin;
//     const worker = ctx.params.worker;
//     const tenant = ctx.state.tenant;
    
//     const body = await ctx.request.body({ type: "json" }).value;
    
//     const workers = container.resolve<WorkerManager>("workers");
//     const jobId = await workers.dispatch(
//       plugin,
//       worker,
//       {
//         tenantId: tenant.id,
//         data: body,
//       },
//       container.getParent() || container
//     );
    
//     ctx.response.body = {
//       success: true,
//       jobId,
//       message: "Worker dispatched",
//     };
//   },
// });

// // Worker status endpoints
// router.register({
//   method: "GET",
//   path: "/api/workers/stats",
//   tenant: false,
//   name: "worker-stats",
//   handler: (ctx) => {
//     const workers = container.resolve<WorkerManager>("workers");
//     ctx.response.body = workers.getStats();
//   },
// });

// router.register({
//   method: "GET",
//   path: "/api/workers/:jobId",
//   tenant: false,
//   name: "worker-job",
//   handler: (ctx) => {
//     const workers = container.resolve<WorkerManager>("workers");
//     const job = workers.getJob(ctx.params.jobId);
    
//     if (!job) {
//       ctx.response.status = 404;
//       ctx.response.body = { error: "Job not found" };
//       return;
//     }
    
//     ctx.response.body = job;
//   },
// });

// Graceful shutdown
const shutdown = async () => {
  const logger = container.resolve<Logger>("logger");
  logger.info("Received shutdown signal");
  
  await engine.shutdown();
  Deno.exit(0);
};

Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

// Print diagnostic information
// console.log("\n" + "═".repeat(70));
// console.log("🎉 OakSeed Engine Ready");
// console.log("═".repeat(70));

// const config = engine.getConfig();
// const tenants = tenantManager.listTenants();
// const plugins = container.resolve<PluginManager>("plugins").list();

// console.log("\n📊 System Information:");
// console.log(`   Environment: ${config.env}`);
// console.log(`   Log Level: ${config.logger?.level}`);
// console.log(`   Server: http://${config.hostname}:${config.port}`);

// console.log("\n🔌 Loaded Plugins:");
// plugins.forEach(name => console.log(`   - ${name}`));

// console.log("\n🏢 Registered Tenants:");
// tenants.forEach(t => {
//   console.log(`   - ${t.id} (${t.name})`);
//   console.log(`     Plugins: ${t.plugins.join(", ")}`);
// });

// console.log("\n🌐 Access URLs:");
// console.log(`   Main: http://${config.hostname}:${config.port}`);
// console.log(`   Health: http://${config.hostname}:${config.port}/health`);
// console.log(`   Tenants: http://${config.hostname}:${config.port}/api/tenants`);

// console.log("\n🏢 Tenant Dashboards (Path-Based):");
// tenants.forEach(t => {
//   console.log(`   ${t.name}: http://${config.hostname}:${config.port}/tenant/${t.id}/dashboard`);
// });

// if (tenants.some(t => t.subdomain)) {
//   console.log("\n🌍 Tenant Dashboards (Subdomain - Requires Hosts File):");
//   tenants.filter(t => t.subdomain).forEach(t => {
//     console.log(`   ${t.name}: http://${t.subdomain}.${config.hostname}:${config.port}/dashboard`);
//   });
//   console.log("\n   ⚠️  For subdomain routing, add to /etc/hosts:");
//   tenants.filter(t => t.subdomain).forEach(t => {
//     console.log(`   127.0.0.1 ${t.subdomain}.${config.hostname}`);
//   });
// }

// console.log("\n📍 Registered Routes:");
// const routes = router.getRoutes();
// console.log(`   Total: ${routes.length}`);
// console.log(`   Global: ${router.getGlobalRoutes().length}`);
// console.log(`   Tenant: ${router.getTenantRoutes().length}`);

// if (engine.isDebug()) {
//   router.printRoutes();
// }

// console.log("\n💡 Quick Test:");
// console.log(`   curl http://${config.hostname}:${config.port}/health`);
// if (tenants.length > 0) {
//   const firstTenant = tenants[0];
//   console.log(`   curl http://${config.hostname}:${config.port}/tenant/${firstTenant.id}/dashboard`);
// }

// console.log("\n" + "═".repeat(70));
// console.log("Press Ctrl+C to stop\n");

// Start the server
await engine.listen();