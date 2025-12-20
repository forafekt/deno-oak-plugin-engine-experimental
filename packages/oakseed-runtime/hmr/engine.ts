// ============================================================================
// hmr/engine.ts - Complete HMR engine implementation
// ============================================================================
import type { Builder } from "../build/builder.ts";
import type { ResolvedConfig } from "../config/loader.ts";
import type { PluginManager } from "../core/plugin-manager.ts";
import { DependencyGraph } from "./graph.ts";
import { encodeMessage, type HMRMessage, type HMRUpdate } from "./protocol.ts";

export interface HMREngine {
  start(): Promise<void>;
  stop(): Promise<void>;
  invalidate(path: string): Promise<void>;
  handleWebSocket(req: Request): Response;
}

export class HMREngineImpl implements HMREngine {
  private clients = new Set<WebSocket>();
  private graph: DependencyGraph;

  constructor(
    private builder: Builder,
    private config: ResolvedConfig,
    private pluginManager: PluginManager,
  ) {
    this.graph = new DependencyGraph();
  }

  async start(): Promise<void> {
    console.log(`[HMR] Server listening on ws://localhost:${this.config.hmr.port}`);
  }

  async stop(): Promise<void> {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
  }

  handleWebSocket(req: Request): Response {
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    socket.addEventListener("open", () => {
      this.clients.add(socket);
      socket.send(encodeMessage({ type: "connected" }));
    });

    socket.addEventListener("close", () => {
      this.clients.delete(socket);
    });

    socket.addEventListener("message", (event) => {
      // Handle ping/pong for keep-alive
      if (event.data === "ping") {
        socket.send(encodeMessage({ type: "pong" }));
      }
    });

    return response;
  }

  async invalidate(changedPath: string): Promise<void> {
    console.log(`[HMR] File changed: ${changedPath}`);

    try {
      // 1. Determine affected modules
      const affected = this.graph.getAffected(changedPath);
      console.log(`[HMR] Affected modules: ${affected.size}`);

      // 2. Check if full reload is needed
      if (this.shouldFullReload(changedPath, affected)) {
        this.broadcast({
          type: "full-reload",
          path: changedPath,
        });
        return;
      }

      // 3. Rebuild affected modules
      const result = await this.builder.build();
      
      if (result.errors.length > 0) {
        this.broadcast({
          type: "error",
          error: {
            message: result.errors[0].text,
            stack: result.errors[0].detail,
          },
        });
        return;
      }

      // 4. Update dependency graph
      if (result.metafile) {
        this.graph.update(result.metafile);
      }

      // 5. Extract updates for affected modules
      const updates = this.extractUpdates(result, affected);

      // 6. Allow plugins to modify updates
      const ctx = {
        file: changedPath,
        timestamp: Date.now(),
        modules: affected,
        read: () => Deno.readTextFile(changedPath),
      };
      await this.pluginManager.runHook("handleHotUpdate", ctx);

      // 7. Send updates to clients
      if (updates.length > 0) {
        this.broadcast({
          type: "update",
          updates,
        });
      }
    } catch (err) {
      console.error("[HMR] Error during invalidation:", err);
      this.broadcast({
        type: "error",
        error: {
          message: (err as Error).message,
          stack: (err as Error).stack,
        },
      });
    }
  }

  private shouldFullReload(changedPath: string, affected: Set<string>): boolean {
    // Full reload conditions
    if (changedPath.endsWith(".html")) return true;
    if (changedPath === this.config.configPath) return true;
    if (changedPath.endsWith(".config.ts")) return true;
    if (changedPath.endsWith(".config.js")) return true;

    // Check if any affected module lacks HMR acceptance
    for (const path of affected) {
      if (!this.graph.hasAcceptance(path)) {
        // Module doesn't accept HMR, need full reload
        return true;
      }
    }

    return false;
  }

  private extractUpdates(result: any, affected: Set<string>): HMRUpdate[] {
    const updates: HMRUpdate[] = [];

    // Extract updated code from build outputs
    for (const output of result.outputs ?? []) {
      const text = new TextDecoder().decode(output.contents);
      
      updates.push({
        path: output.path,
        code: text,
        timestamp: Date.now(),
        type: output.path.endsWith(".css") ? "css-update" : "js-update",
      });
    }

    return updates;
  }

  private broadcast(message: HMRMessage): void {
    const payload = encodeMessage(message);
    
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}