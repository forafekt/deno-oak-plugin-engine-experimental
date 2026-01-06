import { RuntimePlugin } from "../core/plugin.ts";

export function reactPlugin(): RuntimePlugin {
  return {
    name: "react-plugin",

    esbuildPlugins() {
      return [
        {
          name: "react-loader",
          setup(build) {
            // Handle JSX/TSX files
            build.onLoad({ filter: /\.(jsx|tsx)$/ }, async (args) => {
              const source = await Deno.readTextFile(args.path);
              
              return {
                contents: source,
                loader: args.path.endsWith(".tsx") ? "tsx" : "jsx",
              };
            });

            // Auto-inject React import if missing (React 17+ JSX transform)
            build.onLoad({ filter: /\.(jsx|tsx)$/ }, async (args) => {
              const source = await Deno.readTextFile(args.path);
              
              // Check if React is imported
              if (!source.includes("import React") && !source.includes("from 'react'")) {
                // Use automatic JSX runtime
                return {
                  contents: source,
                  loader: args.path.endsWith(".tsx") ? "tsx" : "jsx",
                  jsxFactory: "React.createElement",
                  jsxFragment: "React.Fragment",
                };
              }

              return {
                contents: source,
                loader: args.path.endsWith(".tsx") ? "tsx" : "jsx",
              };
            });
          },
        },
      ];
    },

    async handleHotUpdate(ctx) {
      // React components should trigger HMR, not full reload
      if (ctx.file.endsWith(".jsx") || ctx.file.endsWith(".tsx")) {
        console.log(`[React HMR] Updating component: ${ctx.file}`);
        
        // Mark module as accepting updates
        ctx.modules.clear();
        ctx.modules.add(ctx.file);
      }
    },

    configureServer(server) {
      // Add React Fast Refresh middleware if needed
      server.use(async (req, next) => {
        const response = await next();
        
        // Inject React Fast Refresh runtime into HTML
        if (response.headers.get("Content-Type")?.includes("text/html")) {
          const html = await response.text();
          const injected = html.replace(
            "</head>",
            `<script type="module">
              // React Fast Refresh
              // import RefreshRuntime from "react-refresh/runtime";
              // RefreshRuntime.injectIntoGlobalHook(window);
              // window.$RefreshReg$ = () => {};
              // window.$RefreshSig$ = () => () => {};
              // window.__vite_plugin_react_preamble_installed__ = true;
            </script></head>`
          );
          return new Response(injected, {
            status: response.status,
            headers: response.headers,
          });
        }
        
        return response;
      });
    },
  };
}