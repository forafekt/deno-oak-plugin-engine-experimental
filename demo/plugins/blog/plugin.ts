// engine/plugins/blog/plugin.ts
/**
 * Blog Plugin
 * Complete blog implementation with markdown support
 */

import { Plugin, PluginConfig, ViewEngine, WorkerManager } from "@oakseed/oak-engine/mod.ts";
import { Container } from "@oakseed/di/mod.ts";
import { Logger } from "@oakseed/logger";
import { EventEmitter } from "@oakseed/events";
import { DatabaseDriver } from "@oakseed/types";

export const BlogPlugin: Plugin = {
  name: "blog",
  version: "1.0.0",
  description: "Blog plugin with markdown support and workers",
  type: 'client-server',

  async init(container: Container, config: PluginConfig): Promise<void> {
    const logger = container.resolve<Logger>("logger");
    const events = container.resolve<EventEmitter>("events");

    logger.info("Initializing blog plugin");

    // Register blog service factory for each tenant
    container.registerFactory("blog", (c) => {
      return new BlogService(c);
    });

    // Listen for tenant initialization
    events.on("tenant:initialized", async (data: any) => {
      const { tenant, container: tenantContainer } = data;
      
      if (tenant.plugins.includes("blog")) {
        logger.debug(`Setting up blog for tenant: ${tenant.id}`);
        
        // Initialize blog service
        const blog = tenantContainer.resolve("blog");
        await blog.initialize();
      }
    });
  },

  routes: [
    {
      method: "GET",
      path: "/blog",
      tenant: false,
      name: "blog-list",
      handler: async (ctx, container) => {
        console.log(ctx.state.session?.tenant);
        // ctx.response.redirect('/tenant/tenant1/blog');
        ctx.response.body = {}
      },
    },
    {
      method: "GET",
      path: "/blog/:slug",
      tenant: true,
      handler: async (ctx, container) => {
        const blog = container.resolve<BlogService>("blog");
        const post = await blog.getPost(ctx.params.slug!);

        // if (!post) {
        //   ctx.response.status = 404;
        //   ctx.response.body = { error: "Post not found" };
        //   return;
        // }

        const views = container.resolve<ViewEngine>("views");
        const html = await views.render("blog/post", {
          post: post || {},
          tenant: ctx.state.tenant,
        }, {
          plugin: "blog",
        });

        ctx.response.type = "text/html";
        ctx.response.body = html;
      },
    },
    {
      method: "POST",
      path: "/api/blog/posts",
      tenant: true,
      handler: async (ctx, container) => {
        const blog = container.resolve<BlogService>("blog");
        const body = await ctx.request.body.json()

        // Validate input
        if (!body.title || !body.markdown) {
          ctx.response.status = 400;
          ctx.response.body = { error: "Title and markdown are required" };
          return;
        }

        // Dispatch markdown processing worker
        const workers = container.getParent()?.resolve<WorkerManager>("workers") || 
                       container.resolve<WorkerManager>("workers");
        
        const jobId = await workers.dispatch(
          "blog",
          "process-markdown",
          {
            tenantId: ctx.state.tenant.id,
            data: body,
          },
          container.getParent() || container
        );

        // Wait for worker to complete
        try {
          const result = await workers.waitFor(jobId, 10000);
          
          const post = await blog.createPost({
            title: body.title,
            markdown: body.markdown,
            html: result.data.html,
            author: body.author || "Anonymous",
          });

          ctx.response.body = { 
            success: true, 
            post,
            jobId,
          };
        } catch (error) {
          ctx.response.status = 500;
          ctx.response.body = { 
            error: "Failed to process post",
            message: (error as Error).message,
          };
        }
      },
    },
    {
      method: "DELETE",
      path: "/api/blog/posts/:slug",
      tenant: true,
      handler: async (ctx, container) => {
        const blog = container.resolve<BlogService>("blog");
        await blog.deletePost(ctx.params.slug!);
        ctx.response.body = { success: true };
      },
    },
    {
      method: "GET",
      path: "/tenant/:tenantId/blog",
      tenant: true,
      name: "tenant-blog-list",
      handler: async (ctx, container) => {
         const blog = container.resolve<BlogService>("blog");
        const posts = await blog.listPosts();
        const views = container.resolve<ViewEngine>("views");

        const html = await views.render("blog/list", {
          posts,
          tenant: ctx.state.tenant,
        }, {
          plugin: "blog",
        });

        ctx.response.type = "text/html";
        ctx.response.body = html;
      },
    },
  ],

  workers: [
    {
      name: "process-markdown",
      handler: async (payload, container) => {
        const logger = container.resolve<Logger>("logger");
        logger.debug("Processing markdown");

        const { markdown } = payload.data as { markdown: string };

        // Simple markdown to HTML conversion
        // In production, use: https://deno.land/x/marked or similar
        const html = convertMarkdownToHTML(markdown);

        return {
          success: true,
          data: { html },
        };
      },
    },
  ],

  viewPaths: ["./views"],
};

/**
 * Simple markdown to HTML converter
 */
function convertMarkdownToHTML(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  
  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  
  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  
  // Code blocks
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  
  // Inline code
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");
  
  // Paragraphs
  html = html
    .split("\n\n")
    .map((para) => {
      if (para.trim() && 
          !para.startsWith("<h") && 
          !para.startsWith("<pre") &&
          !para.startsWith("<ul") &&
          !para.startsWith("<ol")) {
        return `<p>${para}</p>`;
      }
      return para;
    })
    .join("\n");

  return html;
}

/**
 * Blog Service
 */
class BlogService {
  private container: Container;
  private posts: Map<string, any> = new Map();
  private initialized = false;

  constructor(container: Container) {
    this.container = container;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const logger = this.container.resolve<Logger>("logger");
    logger.debug("Initializing blog service");

    // Try to create posts table if using SQL database
    if (this.container.has("db")) {
      const db = this.container.resolve<DatabaseDriver>("db");
      
      try {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            markdown TEXT,
            html TEXT,
            author TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);
        logger.debug("Posts table ready");
      } catch (error) {
        logger.warn("Could not create posts table", { error: (error as Error).message });
      }
    }

    this.initialized = true;
  }

  async listPosts(): Promise<any[]> {
    if (this.container.has("db")) {
      const db = this.container.resolve<DatabaseDriver>("db");
      
      try {
        return await db.query("SELECT * FROM posts ORDER BY created_at DESC");
      } catch {
        // Fallback to in-memory
      }
    }

    return Array.from(this.posts.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async getPost(slug: string): Promise<any | null> {
    if (this.container.has("db")) {
      const db = this.container.resolve<DatabaseDriver>("db");
      
      try {
        const results = await db.query(
          "SELECT * FROM posts WHERE slug = ? LIMIT 1",
          [slug]
        );
        return results[0] || null;
      } catch {
        // Fallback to in-memory
      }
    }

    return this.posts.get(slug) || null;
  }

  async createPost(data: {
    title: string;
    markdown: string;
    html: string;
    author: string;
  }): Promise<any> {
    const slug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const post = {
      slug,
      title: data.title,
      markdown: data.markdown,
      html: data.html,
      author: data.author,
      created_at: new Date().toISOString(),
    };

    if (this.container.has("db")) {
      const db = this.container.resolve<DatabaseDriver>("db");
      
      try {
        await db.execute(
          "INSERT INTO posts (slug, title, markdown, html, author, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          [post.slug, post.title, post.markdown, post.html, post.author, post.created_at]
        );
        return post;
      } catch (error) {
        const logger = this.container.resolve<Logger>("logger");
        logger.error("Failed to save post to database", { error: (error as Error).message });
      }
    }

    // Fallback to in-memory
    this.posts.set(slug, post);
    return post;
  }

  async deletePost(slug: string): Promise<void> {
    if (this.container.has("db")) {
      const db = this.container.resolve<DatabaseDriver>("db");
      
      try {
        await db.execute("DELETE FROM posts WHERE slug = ?", [slug]);
        return;
      } catch {
        // Fallback to in-memory
      }
    }

    this.posts.delete(slug);
  }
}

export default BlogPlugin;