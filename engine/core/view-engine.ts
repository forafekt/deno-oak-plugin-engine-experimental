// engine/core/view-engine.ts
/**
 * View Engine
 * Eta-based template rendering with multi-level overrides
 */

import { Eta } from "https://deno.land/x/eta@v3.1.0/src/index.ts";
import { fileExists } from "../modules/utils.ts";
import { Tenant } from "./tenant-manager.ts";
import { Logger } from "../modules/logger.ts";

/**
 * View engine interface
 */
export interface ViewEngine {
  render(
    view: string,
    data: Record<string, unknown>,
    options?: ViewRenderOptions
  ): Promise<string>;
  addPath(path: string): void;
  setTenant(tenant: Tenant | null): void;
}

export interface ViewRenderOptions {
  layout?: string;
  tenant?: Tenant;
  plugin?: string;
}

export class EtaViewEngine implements ViewEngine {
  private eta: Eta;
  private viewPaths: string[] = [];
  private currentTenant: Tenant | null = null;
  private logger: Logger;

  constructor(logger: Logger, viewPaths: string[] = []) {
    this.logger = logger;
    this.viewPaths = viewPaths;
    
    this.eta = new Eta({
      views: "./views",
      cache: Deno.env.get("DENO_ENV") === "production",
      autoEscape: true,
    });
  }

  /**
   * Add a view search path
   */
  addPath(path: string): void {
    if (!this.viewPaths.includes(path)) {
      this.viewPaths.unshift(path);
      this.logger.debug(`View path added: ${path}`);
    }
  }

  /**
   * Set current tenant for view resolution
   */
  setTenant(tenant: Tenant | null): void {
    this.currentTenant = tenant;
  }

  /**
   * Render a view
   */
  async render(
    view: string,
    data: Record<string, unknown> = {},
    options: ViewRenderOptions = {}
  ): Promise<string> {
    const tenant = options.tenant || this.currentTenant;
    const viewPath = await this.resolveView(view, {
      tenant,
      plugin: options.plugin,
    });

    if (!viewPath) {
      throw new Error(`View not found: ${view}`);
    }

    this.logger.debug(`Rendering view: ${view} -> ${viewPath}`);

    // Load view content
    const content = await Deno.readTextFile(viewPath);

    // Render with Eta
    const rendered = await this.eta.renderStringAsync(content, {
      ...data,
      tenant,
      layout: options.layout,
    });

    // Apply layout if specified
    if (options.layout) {
      return await this.renderWithLayout(options.layout, rendered, data, {
        tenant,
        plugin: options.plugin,
      });
    }

    return rendered;
  }

  /**
   * Render with layout
   */
  private async renderWithLayout(
    layout: string,
    content: string,
    data: Record<string, unknown>,
    options: { tenant?: Tenant | null; plugin?: string }
  ): Promise<string> {
    const layoutPath = await this.resolveView(`layouts/${layout}`, options);

    if (!layoutPath) {
      this.logger.warn(`Layout not found: ${layout}, rendering without layout`);
      return content;
    }

    const layoutContent = await Deno.readTextFile(layoutPath);

    return await this.eta.renderStringAsync(layoutContent, {
      ...data,
      content,
      tenant: options.tenant,
    });
  }

  /**
   * Resolve view path with override hierarchy:
   * 1. Tenant-specific override
   * 2. Theme override
   * 3. Host app views
   * 4. Plugin views
   * 5. Core views
   */
  private async resolveView(
    view: string,
    options: { tenant?: Tenant | null; plugin?: string }
  ): Promise<string | null> {
    const viewFile = view.endsWith(".eta") ? view : `${view}.eta`;
    const searchPaths: string[] = [];

    // 1. Tenant-specific override
    if (options.tenant?.config.viewOverrides?.[view]) {
      searchPaths.push(options.tenant.config.viewOverrides[view]);
    }

    // 2. Theme override
    if (options.tenant?.config.theme) {
      searchPaths.push(`./themes/${options.tenant.config.theme}/${viewFile}`);
    }

    // 3. Host app views
    for (const basePath of this.viewPaths) {
      searchPaths.push(`${basePath}/${viewFile}`);
    }

    // 4. Plugin views
    if (options.plugin) {
      searchPaths.push(`./engine/plugins/${options.plugin}/views/${viewFile}`);
      searchPaths.push(`./plugins/${options.plugin}/views/${viewFile}`);
    }

    // 5. Core views
    searchPaths.push(`./engine/views/${viewFile}`);

    // Search for the view
    for (const path of searchPaths) {
      if (await fileExists(path)) {
        return path;
      }
    }

    return null;
  }

  /**
   * Check if a view exists
   */
  async exists(
    view: string,
    options: ViewRenderOptions = {}
  ): Promise<boolean> {
    const tenant = options.tenant || this.currentTenant;
    const viewPath = await this.resolveView(view, {
      tenant,
      plugin: options.plugin,
    });
    return viewPath !== null;
  }

  /**
   * Get all registered view paths
   */
  getViewPaths(): string[] {
    return [...this.viewPaths];
  }
}