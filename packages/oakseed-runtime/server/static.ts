// ============================================================================
// server/static.ts - Static file serving
// ============================================================================
import { extname } from "@oakseed/x/std/path.ts";

export class StaticFileServer {
  private mimeTypes = new Map<string, string>([
    [".html", "text/html"],
    [".css", "text/css"],
    [".scss", "text/css"],
    [".sass", "text/css"],
    [".js", "application/javascript"],
    [".ts", "application/javascript"],
    [".tsx", "application/javascript"],
    [".json", "application/json"],
    [".png", "image/png"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".gif", "image/gif"],
    [".svg", "image/svg+xml"],
    [".ico", "image/x-icon"],
    [".woff", "font/woff"],
    [".woff2", "font/woff2"],
    [".ttf", "font/ttf"],
    [".eot", "application/vnd.ms-fontobject"],
  ]);

  constructor(private root: string) {}

  async serve(pathname: string): Promise<Response | null> {
    try {
      const filePath = `${this.root}${pathname}`;
      const stat = await Deno.stat(filePath);

      if (stat.isDirectory) {
        // Try index.html
        return this.serve(`${pathname}/index.html`);
      }

      const file = await Deno.readFile(filePath);
      const ext = extname(pathname);
      const contentType = this.mimeTypes.get(ext) || "application/octet-stream";

      return new Response(file, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
        },
      });
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        return null;
      }
      throw err;
    }
  }
}