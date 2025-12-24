// ============================================================================
// server/dev-server.ts - Complete implementation
// ============================================================================
import type { Builder } from "../build/builder.ts";
import type { HMREngine } from "../hmr/engine.ts";
import type { ResolvedConfig } from "../config/loader.ts";
import type { PluginManager } from "../core/plugin-manager.ts";
import { MiddlewareStack, corsMiddleware, loggingMiddleware } from "./middleware.ts";
import { StaticFileServer } from "./static.ts";

export class DevServer {
  private server: Deno.HttpServer | null = null;
  private middleware: MiddlewareStack;
  private staticServer: StaticFileServer;

  constructor(
    private builder: Builder,
    private hmr: HMREngine,
    private config: ResolvedConfig,
    private pluginManager: PluginManager,
  ) {
    this.middleware = new MiddlewareStack();
    this.staticServer = new StaticFileServer(config.root);
    
    // Setup default middleware
    this.middleware.use(corsMiddleware());
    this.middleware.use(loggingMiddleware());
    
    // Allow plugins to add middleware
    this.pluginManager.runHook("configureServer", this);
  }

  use(middleware: (req: Request, next: () => Promise<Response>) => Promise<Response>): void {
    this.middleware.use(middleware);
  }

  async start(): Promise<void> {
    this.server = Deno.serve({
      port: this.config.server.port,
      hostname: this.config.server.host,
      onListen: ({ hostname, port }) => {
        console.log(`\n  ➜ Local:   http://${hostname}:${port}/`);
        console.log(`  ➜ Network: use --host to expose\n`);
      },
    }, (req) => this.middleware.handle(req, () => this.handleRequest(req)));
    await Promise.resolve();
  }

  async stop(): Promise<void> {
    await this.server?.shutdown();
    this.server = null;
  }

  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // 1. HMR WebSocket upgrade
    if (url.pathname === "/__hmr") {
      return this.hmr.handleWebSocket(req);
    }

    // 2. HMR client script
    if (url.pathname === "/__hmr_client.js") {
      return new Response(HMR_CLIENT_CODE, {
        headers: { "Content-Type": "application/javascript" },
      });
    }

    // 3. Serve from esbuild output (built modules)
    if (url.pathname.startsWith("/__build/")) {
      const modulePath = url.pathname.slice("/__build/".length);
      const output = this.builder.getOutput(modulePath);
      
      if (output) {
        // Uint8Array<ArrayBufferLike> to BodyInit
        const body = new TextDecoder().decode(output.contents);
        return new Response(body, {
          headers: {
            "Content-Type": this.getContentType(modulePath),
            "Cache-Control": "no-cache",
            "X-Sourcemap": output.map ? `/__build/${modulePath}.map` : "",
          },
        });
      }
    }

    // 4. Source maps
    if (url.pathname.endsWith(".map")) {
      const modulePath = url.pathname.slice(0, -4);
      const output = this.builder.getOutput(modulePath);
      
      if (output?.map) {
        return new Response(output.map, {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 5. Static files
    const staticResponse = await this.staticServer.serve(url.pathname);
    if (staticResponse) {
      // Inject HMR client into HTML
      if (staticResponse.headers.get("Content-Type")?.includes("text/html")) {
        const html = await staticResponse.text();
        const injected = this.injectHMRClient(html);
        return new Response(injected, {
          headers: staticResponse.headers,
        });
      }
      return staticResponse;
    }

    // 6. Not found
    return new Response("Not Found", { status: 404 });
  }

  private injectHMRClient(html: string): string {
    const hmrScript = `<script type="module" src="/__hmr_client.js"></script>`;
    
    // Try to inject before </head>
    if (html.includes("</head>")) {
      return html.replace("</head>", `${hmrScript}\n</head>`);
    }
    
    // Otherwise inject at start of body
    if (html.includes("<body>")) {
      return html.replace("<body>", `<body>\n${hmrScript}`);
    }
    
    // Last resort: prepend to document
    return hmrScript + "\n" + html;
  }

  private getContentType(path: string): string {
    // allow ts
    if (path.endsWith(".ts") || path.endsWith(".tsx")) return "application/javascript";
    if (path.endsWith(".js") || path.endsWith(".mjs")) return "application/javascript";
    if (path.endsWith(".css") || path.endsWith(".scss") || path.endsWith(".sass")) return "text/css";
    if (path.endsWith(".json")) return "application/json";
    if (path.endsWith(".html")) return "text/html";
    return "application/octet-stream";
  }
}


const HMR_CLIENT_CODE = Deno.readTextFileSync(
  new URL("../hmr/client.js", import.meta.url),
);

// const HMR_CLIENT_CODE = `
// // HMR Client Runtime
// console.log('[HMR] Connecting...');

// const socket = new WebSocket('ws://' + location.host + '/__hmr');

// socket.addEventListener('open', () => {
//   console.log('[HMR] Connected');
// });

// socket.addEventListener('message', async (event) => {
//   const message = JSON.parse(event.data);
  
//   if (message.type === 'full-reload') {
//     console.log('[HMR] Full reload', message.path || '');
//     location.reload();
//     return;
//   }
  
//   if (message.type === 'update') {
//     console.log('[HMR] Updating modules:', message.updates.length);
    
//     for (const update of message.updates) {
//       try {
//         // Create a blob URL for the new module
//         const blob = new Blob([update.code], { type: 'application/javascript' });
//         const url = URL.createObjectURL(blob);
        
//         // Dynamically import the new version
//         await import(url + '?t=' + update.timestamp);
        
//         console.log('[HMR] Updated:', update.path);
//         URL.revokeObjectURL(url);
//       } catch (err) {
//         console.error('[HMR] Update failed:', err);
//         location.reload();
//       }
//     }
//   }
  
//   if (message.type === 'error') {
//     console.error('[HMR] Error:', message.error);
//   }
// });

// socket.addEventListener('close', () => {
//   console.log('[HMR] Disconnected. Attempting to reconnect...');
//   setTimeout(() => location.reload(), 1000);
// });

// socket.addEventListener('error', (err) => {
//   console.error('[HMR] WebSocket error:', err);
// });

// // Export HMR API for modules
// export const hot = {
//   accept(deps, callback) {
//     // Module accepts updates
//     console.log('[HMR] Module accepts updates:', deps);
//   },
//   decline() {
//     // Module requires full reload
//     console.log('[HMR] Module declines updates');
//   },
//   dispose(callback) {
//     // Cleanup before module replacement
//     console.log('[HMR] Module cleanup registered');
//   },
//   invalidate() {
//     // Force reload this module
//     location.reload();
//   },
//   data: {},
// };

// if (import.meta) {
//   import.meta.hot = hot;
// }
// `;