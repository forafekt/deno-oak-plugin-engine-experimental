// runtime/hmr/client.ts (injected into browser)
interface HMRRuntime {
  accept(deps: string[], callback: (modules: any) => void): void;
  decline(): void;
  invalidate(): void;
}

const moduleCache = new Map<string, any>();
const acceptanceMap = new Map<string, Function>();

const HMR_PORT = 24606;

const ws = new WebSocket(`ws://localhost:${HMR_PORT}`);

ws.onmessage = async (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === "full-reload") {
    location.reload();
    return;
  }
  
  if (message.type === "update") {
    for (const update of message.updates) {
      // 1. Dispose old module
      const oldModule = moduleCache.get(update.path);
      if (oldModule?.__hmr_dispose) {
        await oldModule.__hmr_dispose();
      }
      
      // 2. Evaluate new code
      const blob = new Blob([update.code], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);
      const newModule = await import(url);
      
      // 3. Update cache
      moduleCache.set(update.path, newModule);
      
      // 4. Notify acceptors
      const accept = acceptanceMap.get(update.path);
      if (accept) {
        await accept(newModule);
      }
    }
  }

  if (message.type === "error") {
    ws.send(JSON.stringify({ type: "error", error: message.error }));
  }
};

declare global {
  interface Window {
    __hmr: HMRRuntime;
  }
}

// Exposed to user modules
(globalThis as any).__hmr = {
  addEventListener(message: string, callback: (event: any) => void) {
    ws.addEventListener(message, callback);
  },
  accept(deps: string[], callback: (modules: any) => void) {
    for (const dep of deps) {
      acceptanceMap.set(dep, callback);
    }
    return false;
  },
  decline() {
    // Force full reload for this module
    ws.send(JSON.stringify({ type: "decline" }));
    return true;
  },
  invalidate() {
    // Force full reload for this module
    ws.send(JSON.stringify({ type: "invalidate" }));
    return true;
  },
};

if (typeof window !== "undefined") {
  (window as any).__hmr = (globalThis as any).__hmr;
}