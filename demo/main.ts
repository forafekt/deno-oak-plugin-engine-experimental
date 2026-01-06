// example-app/main.ts
/**
 * Example OakSeed Application - FIXED VERSION
 * Demonstrates proper tenant routing setup with debugging
 */

import { oakEngine } from "@oakseed/oak-engine/mod.ts";

const engine = await oakEngine();

const router = engine.getRouter();

router.register({
  method: "GET",
  path: "/",
  tenant: false,
  name: "home",
  handler: (kwargs) => {
    return async (ctx, _next) => {
    const views = kwargs.container.resolve("views");
    const html = await views.render("home", {
      title: "OakSeed Engine",
      description: "Multi-tenant plugin framework for Deno",
    });
    ctx.response.type = "text/html";
    ctx.response.body = html;
  }
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





// Start the server
await engine.listen();
// await engine.shutdown();