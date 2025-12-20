// plugins/errorOverlay.ts
import type { RuntimePlugin } from "../core/plugin.ts";

let lastError: any = null;

export function errorOverlayPlugin(): RuntimePlugin {
  return {
    name: "error-overlay-plugin",

    esbuildPlugins() {
      return [
        {
          name: "error-overlay-esbuild",
          setup(build) {
            // Capture build errors
            build.onEnd((result) => {
              if (result.errors.length > 0) {
                lastError = formatEsbuildError(result.errors[0]);
                console.error("[Build Error]", lastError);
              } else {
                lastError = null;
              }
            });
          },
        },
      ];
    },

    configureServer(server) {
      // Inject overlay runtime into HTML
      server.use(async (req, next) => {
        const res = await next();

        if (res.headers.get("Content-Type")?.includes("text/html")) {
          const html = await res.text();

          const injected = html.replace(
            "</body>",
            `
<script type="module" src="/__error_overlay.js"></script>
</body>
`
          );

          return new Response(injected, {
            status: res.status,
            headers: res.headers,
          });
        }

        return res;
      });

      server.use(async (req, next) => {
        const url = new URL(req.url);
        if (url.pathname === "/__error_overlay.js") {
          return new Response(ERROR_OVERLAY_RUNTIME, {
            headers: { "Content-Type": "application/javascript" },
          });
        }
        return await next();
      });
    },

    handleHotUpdate(ctx) {
      // Push error or clear event to client
      //   if (lastError) {
      //     ctx.server.broadcast({
      //       type: "error",
      //       error: lastError,
      //     });
      //   } else {
      //     ctx.server.broadcast({
      //       type: "error-clear",
      //     });
      //   }
    },
  };
}

const ERROR_OVERLAY_RUNTIME = `
let overlay;

function createOverlay(message, stack) {
  removeOverlay();

  overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.background = "rgba(0,0,0,0.85)";
  overlay.style.color = "#ff5555";
  overlay.style.fontFamily = "monospace";
  overlay.style.padding = "20px";
  overlay.style.zIndex = "99999";
  overlay.style.overflow = "auto";

  overlay.innerHTML = \`
    <h2>⚠ Build Error</h2>
    <pre>\${message}</pre>
    <pre style="color:#aaa">\${stack || ""}</pre>
    <button style="
      margin-top:16px;
      padding:8px 12px;
      background:#222;
      color:white;
      border:1px solid #555;
      cursor:pointer;
    ">Dismiss</button>
  \`;

  overlay.querySelector("button").onclick = removeOverlay;
  document.body.appendChild(overlay);
}

function removeOverlay() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}
// createOverlay(new Error("TEst").message, new Error("TEst").stack);
// HMR connection (assumes your runtime exposes this)
if (globalThis.__hmr) {
  globalThis.__hmr.addEventListener("message", (e) => {
    const payload = JSON.parse(e.data);

    if (payload.type === "error") {
      createOverlay(payload.error.message, payload.error.stack);
    }

    if (payload.type === "error-clear") {
      removeOverlay();
    }
  });
}
`;

function formatEsbuildError(error: any) {
  const location = error.location;

  return {
    message: error.text,
    file: location?.file,
    line: location?.line,
    column: location?.column,
    stack: location
      ? location.file + ":" + location.line + ":" + location.column
      : "",
  };
}
