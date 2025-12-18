// engine/plugins/fileSystemRouter/plugin.ts
/**
 * FileSystemRouter Plugin
 * Complete fileSystemRouter implementation
 */

import { send } from "@oakseed/x/oak.ts";
import { join } from "@oakseed/x/std/path.ts";
import {
  Plugin,
  Container,
  PluginConfig,
  EventEmitter,
  Logger,
} from "@oakseed/engine/mod.ts";

export const FileSystemRouterPlugin: Plugin = {
  name: "fileSystemRouter",
  version: "1.0.0",
  description: "FileSystemRouter plugin",
  type: 'server',

  async init(container: Container, config: PluginConfig): Promise<void> {
    const logger = container.resolve<Logger>("logger");
    const events = container.resolve<EventEmitter>("events");

    logger.info("Initializing fileSystemRouter plugin");

    // Register fileSystemRouter service factory for each tenant
    container.registerFactory("fileSystemRouter", (c) => {
      return new FileSystemRouterService(c);
    });

    // Listen for tenant initialization
    events.on("tenant:initialized", async (data: any) => {
      const { tenant, container: tenantContainer } = data;

      if (tenant.plugins.includes("fileSystemRouter")) {
        logger.debug(`Setting up fileSystemRouter for tenant: ${tenant.id}`);

        // Initialize fileSystemRouter service
        const fileSystemRouter = tenantContainer.resolve("fileSystemRouter");
        await fileSystemRouter.initialize();
      }
    });
  },

  routes: [{
    method: 'GET',
    path: "/@fs/(.*)",
    tenant: false,
    async handler(ctx, container) {
      const filePath = ctx.params[0];
      if (!filePath) {
        ctx.response.status = 404;
        ctx.response.body = {
          error: "File not found",
          message: "No file path provided",
          path: filePath,
        };
        return;
      }

      // TODO: Add proper types
      const config = container.resolve<Record<string, any>>("config");
      const root = join(Deno.cwd(), config?.outputDir || '.out')

      // Asynchronously fulfill a response with a file from the local file system.
      // Requires Deno read permission for the root directory.
      await send(ctx, filePath, { root });
    },
    middleware: []
  }],
  workers: [],
};

/**
 * FileSystemRouter Service
 */
class FileSystemRouterService {
  private container: Container;
  private initialized = false;

  constructor(container: Container) {
    this.container = container;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const logger = this.container.resolve<Logger>("logger");
    logger.debug("Initializing fileSystemRouter service");

    this.initialized = true;
  }
}

export default FileSystemRouterPlugin;
