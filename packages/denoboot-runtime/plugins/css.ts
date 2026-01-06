// ============================================================================
// plugins/css.ts - CSS handling
// ============================================================================
import type { RuntimePlugin } from "../core/plugin.ts";

export function cssPlugin(): RuntimePlugin {
  return {
    name: "css-plugin",

    esbuildPlugins() {
      return [{
        name: "css-loader",
        setup(build) {
          // Handle CSS imports
          build.onLoad({ filter: /\.css$/ }, async (args) => {
            const css = await Deno.readTextFile(args.path);
            
            // In dev mode, inject CSS via JS
            if (build.initialOptions.write === false) {
              return {
                contents: `
                  const style = document.createElement('style');
                  style.textContent = ${JSON.stringify(css)};
                  document.head.appendChild(style);
                  
                  // HMR support
                  if (import.meta.hot) {
                    import.meta.hot.accept();
                    import.meta.hot.dispose(() => {
                      style.remove();
                    });
                  }
                `,
                loader: 'ts',
              };
            }

            // Production: extract to separate file
            return {
              contents: css,
              loader: "css",
            };
          });
        },
      }];
    },

    async handleHotUpdate(ctx) {
      if (ctx.file.endsWith(".css")) {
        // CSS changes always trigger HMR
        const newCSS = await ctx.read();
        
        // Mark as accepted so it doesn't cascade
        ctx.modules.clear();
        ctx.modules.add(ctx.file);
      }
    },
  };
}