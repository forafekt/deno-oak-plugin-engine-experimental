// runtime/core/resolver.ts
import type * as esbuild from "@denoboot/x/esbuild.ts";

export interface ResolverOptions {
  root: string;
  external: string[];
  platform: "browser" | "node" | "neutral";
}

export class Resolver {
  // Deno's native resolution for imports
  resolveDeno(specifier: string, importer: string): string {
    // Handles:
    // - https:// imports
    // - jsr:@scope/pkg
    // - npm:package-name
    // - file:// and relative paths
    
    return new URL(specifier, importer).href;
  }
  
  // esbuild plugin for Deno-style imports
  esbuildPlugin(): esbuild.Plugin {
    return {
      name: "deno-resolver",
      setup(build) {
        // Intercept imports to handle Deno-specific patterns
        build.onResolve({ filter: /^(https?:|jsr:|npm:)/ }, (args) => {
          return {
            path: args.path,
            external: true, // Don't bundle URLs by default
          };
        });
      },
    };
  }
}