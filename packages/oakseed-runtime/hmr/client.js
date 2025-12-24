// runtime/hmr/client.js (injected into browser)
const moduleCache = new Map();
const acceptanceMap = new Map();

const HMR_PORT = 24606;

const ws = new WebSocket('ws://' + location.host + '/__hmr');

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

// Exposed to user modules
globalThis.__hmr = {
  on(type, callback) {
    ws.addEventListener(type, callback);
  },
  accept(deps, callback) {
    for (const dep of deps) {
      acceptanceMap.set(dep, callback);
    }
    ws.send(JSON.stringify({ type: "accept", deps }));
    return true;
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
  (window).__hmr = (globalThis).__hmr;
}