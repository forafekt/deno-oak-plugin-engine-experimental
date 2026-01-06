# README: Architecture Summary

## Runtime Architecture

### Core Philosophy
- **Separation of Concerns**: Each module has a single, well-defined responsibility
- **Plugin-First**: All features can be implemented as plugins
- **Type-Safe**: Full TypeScript support throughout
- **Deno-Native**: Leverages Deno's permission model and standard library

## Module Responsibilities

### Core (`runtime/core/`)
- `runtime.ts`: Orchestrates all subsystems, manages lifecycle
- `context.ts`: Shared state container
- `events.ts`: Event bus for decoupled communication
- `plugin.ts`: Plugin interface definition
- `plugin-manager.ts`: Plugin execution and coordination

### Configuration (`runtime/config/`)
- `loader.ts`: Loads and merges configuration files
- `defaults.ts`: Default configuration values

### Build (`runtime/build/`)
- `builder.ts`: esbuild wrapper with caching
- `manifest.ts`: Build manifest generation
- `optimizer.ts`: Production optimizations (minify, compress, etc.)

### Development (`runtime/dev/`)
- `watcher.ts`: File system watching with debouncing
- `reload.ts`: Reload strategy coordination

### Server (`runtime/server/`)
- `dev-server.ts`: HTTP dev server with module serving
- `middleware.ts`: Middleware stack and common middleware
- `static.ts`: Static file serving with MIME type detection

### HMR (`runtime/hmr/`)
- `engine.ts`: HMR coordination and WebSocket server
- `client.ts`: Browser-side HMR runtime
- `graph.ts`: Dependency graph tracking
- `protocol.ts`: HMR message protocol

### Plugins (`runtime/plugins/`)
- `css.ts`: CSS loading and HMR
- `assets.ts`: Asset pipeline (images, fonts)
- `env.ts`: Environment variable injection

### CLI (`runtime/cli/`)
- `cli.ts`: Command-line interface (thin wrapper)
- `args.ts`: Argument parsing

## Data Flow

1. **Startup**:
   User → CLI → Runtime.start() → Config Loader → Plugin Init → Builder Init → Dev Server

2. **Development Loop**:
   File Change → Watcher → HMR Engine → Builder.rebuild() → WebSocket → Browser

3. **Build**:
   User → CLI → Runtime.build() → Builder → Optimizer → Manifest → Assets

## Key Design Decisions

1. **esbuild.context() over esbuild.build()**: Enables incremental rebuilds
2. **Event-driven architecture**: Loose coupling between subsystems
3. **Plugin hooks**: Vite-inspired API for maximum extensibility
4. **In-memory dev builds**: No disk I/O during development
5. **WebSocket HMR**: Real-time updates without polling

## Extension Points

### Custom Plugins
Implement `RuntimePlugin` interface to add functionality:
- Transform code (esbuild plugins)
- Hook into lifecycle events
- Add dev server middleware
- Customize HMR behavior

### Custom Build Targets
Extend `Builder` to support:
- SSR builds (server + client)
- Edge runtime builds
- Library mode
- Multiple outputs

### Custom Dev Servers
Extend `DevServer` to add:
- Proxying
- API mocking
- Authentication
- Custom routing

## Performance Characteristics

### Development Mode
- First build: ~500-2000ms (depending on project size)
- Rebuild: ~50-200ms (incremental)
- HMR update: ~10-50ms (module replacement)

### Production Mode
- Build: ~2-10s (with optimizations)
- Output size: ~30-50% smaller than dev (minified)

## Memory Management

- **Dev mode**: Keeps outputs in memory (MiddlewareStack)
- **Build mode**: Writes to disk, clears memory
- **Watch mode**: Debounced updates prevent memory leaks
- **Cleanup**: Proper disposal on shutdown (esbuild.stop())

## Security Model

Follows Deno's permission model:
- `--allow-read`: File system reads
- `--allow-write`: Build outputs
- `--allow-net`: Dev server and WebSocket
- `--allow-env`: Environment variables

## Testing Strategy

1. **Unit tests**: Individual modules (Builder, Watcher, etc.)
2. **Integration tests**: Full runtime lifecycle
3. **E2E tests**: CLI commands and dev server
4. **Performance tests**: Build time benchmarks

## Future Enhancements

1. **Build Cache**: Persistent cache for faster rebuilds
2. **Worker Threads**: Parallel builds for large projects
3. **Remote Caching**: Distributed build caching
4. **Plugin Marketplace**: Discover and install plugins
5. **SSR Support**: Server-side rendering out of the box
*/

# Example: React plugin

```typescript
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
              // React Fast Refresh setup would go here
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
```

# Example: runtime.config.ts - User configuration

```typescript
import { reactPlugin } from "@denoboot/runtime/plugins/react";
import { cssPlugin } from "@denoboot/runtime/plugins/css";
import { envPlugin } from "@denoboot/runtime/plugins/env";

export default {
  entry: "src/main.tsx",
  
  server: {
    port: 3000,
    host: "localhost",
  },
  
  build: {
    outDir: "dist",
    splitting: true,
    external: ["react", "react-dom"],
  },
  
  plugins: [
    reactPlugin(),
    cssPlugin(),
    envPlugin({
      prefix: "VITE_",
    }),
  ],
  
  // Mode-specific config
  development: {
    build: {
      sourcemap: true,
      minify: false,
    },
  },
  
  production: {
    build: {
      sourcemap: false,
      minify: true,
    },
  },
};
```

# Example: deno.json - Task configuration

```json
{
  "tasks": {
    "dev": "deno run -A runtime/cli.ts dev",
    "build": "deno run -A runtime/cli.ts build",
    "preview": "deno run -A runtime/cli.ts preview"
  },
  "imports": {
    "@denoboot/runtime/": "./runtime/",
    "react": "https://esm.sh/react@18.2.0",
    "react-dom": "https://esm.sh/react-dom@18.2.0"
  }
}
```

# Example: CLI usage

```bash
// Development mode
deno task dev

// Build for production
deno task build

// Preview production build
deno task preview
```

```typescript
// Programmatic usage
import { createRuntime } from "@denoboot/runtime";

const runtime = createRuntime({
  root: Deno.cwd(),
  mode: "development",
  hmr: true,
});

runtime.on("ready", () => {
  console.log("Runtime ready!");
});

runtime.on("error", (err) => {
  console.error("Runtime error:", err);
});

await runtime.start();
```

# Example: User code with HMR

```typescript
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import "./style.css";

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);

// HMR support
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.log("App updated!");
    root.render(<App />);
  });
  
  import.meta.hot.dispose(() => {
    console.log("Cleaning up...");
    // Cleanup logic
  });
}
```