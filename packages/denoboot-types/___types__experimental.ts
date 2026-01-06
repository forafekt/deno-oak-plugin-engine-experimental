// @ts-ignore

import { ApplicationOptions, Context, ListenOptions, Middleware, RouterOptions } from "@denoboot/x/oak.ts";
import type {DenoBootRuntimeConfig } from "@denoboot/runtime/mod.ts";
import { ServerRequest } from "https://jsr.io/@oak/oak/17.2.0/types.ts";
import { Plugin } from "@denoboot/x/esbuild.ts";
import { Container } from "@denoboot/di/mod.ts";
import { PluginManager } from "@denoboot/engine/plugin_manager.ts";
import { TenantManager, Tenant, TenantResolver } from "@denoboot/engine/mod.ts";
import { ViewEngine } from "@denoboot/engine/view_engine.ts";
import { WorkerManager } from "@denoboot/engine/worker_manager.ts";
import { Logger, LoggerOptions } from "@denoboot/logger/mod.ts";



export interface BootstrapOptionsV2 {
  env?: string | Record<string, any>;
  engine?: {
    application?: ApplicationOptions<Record<string, any>, ServerRequest>;
    router?: {
      options?: RouterOptions;
      globalContainer?: Container;
      tenantManager?: TenantManager;
      logger?: Logger;
    },
    /**
     * Start listening for requests, processing registered middleware on each request. If the options .secure is undefined or false, the listening will be over HTTP. If the options .secure property is true, a .certFile and a .keyFile property need to be supplied and requests will be processed over HTTPS.
     * Omitting options will default to { port: 0 } which allows the operating system to select the port.
     */
    listener?: string | ListenOptions,
    pluginManager?: PluginManager;
    tenantManager?: TenantManager;
    workerManager?: WorkerManager;
    viewEngine?: ViewEngine;
    plugins?: Plugin[];
    tenants?: string | Tenant[];
    middleware?: Middleware[];
    tenantResolver?: TenantResolver;
    container?: Container;
    logger?: LoggerOptions;
    viewPaths?: string[];
    assetPaths?: string[];
    pluginPaths?: string[];
    debug?: boolean;
  };
  runtime?: {
    client?: {
      esbuild?: DenoBootRuntimeConfig;
    }
    server?: {
      deno?: Record<string, any>;
    }
  };
}

const myConfigExamples: BootstrapOptionsV2 = {
  engine: {
    listener: { port: 3000,},
    plugins: [],
    middleware: [],
    tenants: './tenants.json',
    tenantResolver: {
      resolve: async (ctx: Context) => {
        return {'id': 'default', 'name': 'default', 'config': {}, 'plugins': []};
      }
    }
  },
  runtime: {
    client: {
      esbuild: {
        entry: './demo/app/client.ts',
        root: "./demo/app",
        mode: "development",
        configPath: "./demo/app/runtime.config.ts",
        server: {
          port: 0,
          host: ""
        },
        build: {
          outDir: "./demo/app/build",
          splitting: false,
          external: [],
          sourcemap: false,
          minify: false
        },
        hmr: {
          port: 0,
          host: ""
        },
        plugins: []
      }
    }
  }
}
