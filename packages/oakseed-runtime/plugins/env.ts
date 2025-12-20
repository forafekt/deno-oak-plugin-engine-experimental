// ============================================================================
// plugins/env.ts - Environment variables
// ============================================================================
import type { RuntimePlugin } from "../core/plugin.ts";

export function envPlugin(options?: {
  prefix?: string;
  env?: Record<string, string>;
}): RuntimePlugin {
  const prefix = options?.prefix ?? "OAKSEED_";
  const customEnv = options?.env ?? {};

  return {
    name: "env-plugin",

    esbuildPlugins() {
      // Collect env vars that match prefix
      const env: Record<string, string> = {};
      for (const [key, value] of Object.entries(Deno.env.toObject())) {
        if (key.startsWith(prefix)) {
          env[key] = value;
        }
      }

      // Merge with custom env
      Object.assign(env, customEnv);

      return [{
        name: "env-loader",
        setup(build) {
          // Replace import.meta.env.* with actual values
          const define: Record<string, string> = {};
          for (const [key, value] of Object.entries(env)) {
            define[`import.meta.env.${key}`] = JSON.stringify(value);
          }

          // Add mode and dev flags
          define["import.meta.env.MODE"] = JSON.stringify(
            build.initialOptions.minify ? "production" : "development"
          );
          define["import.meta.env.DEV"] = String(!build.initialOptions.minify);
          define["import.meta.env.PROD"] = String(!!build.initialOptions.minify);

          build.initialOptions.define = {
            ...build.initialOptions.define,
            ...define,
          };
        },
      }];
    },
  };
}