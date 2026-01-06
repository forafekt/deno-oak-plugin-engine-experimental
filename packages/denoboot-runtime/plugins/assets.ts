// ============================================================================
// plugins/assets.ts - Asset pipeline
// ============================================================================
import type { RuntimePlugin } from "../core/plugin.ts";
import { extname } from "@denoboot/x/std/path.ts";

export function assetsPlugin(options?: { 
  publicDir?: string;
  assetsInlineLimit?: number;
}): RuntimePlugin {
  const publicDir = options?.publicDir ?? "public";
  const inlineLimit = options?.assetsInlineLimit ?? 4096; // 4KB

  return {
    name: "assets-plugin",

    esbuildPlugins() {
      return [{
        name: "assets-loader",
        setup(build) {
          // Handle images and fonts
          build.onLoad({ filter: /\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/ }, async (args) => {
            const content = await Deno.readFile(args.path);
            const ext = extname(args.path);

            // Inline small files as base64
            if (content.length < inlineLimit) {
              const base64 = btoa(String.fromCharCode(...content));
              const mimeType = getMimeType(ext);
              
              return {
                contents: `export default "data:${mimeType};base64,${base64}"`,
                loader: "js",
              };
            }

            // Copy to output directory and return URL
            const hash = await hashContent(content);
            const filename = `assets/${hash}${ext}`;
            
            return {
              contents: `export default "/${filename}"`,
              loader: "js",
            };
          });
        },
      }];
    },
  };
}

function getMimeType(ext: string): string {
  const types: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };
  return types[ext] || "application/octet-stream";
}

async function hashContent(content: Uint8Array): Promise<string> {
    // Uint8Array<ArrayBufferLike> to BufferSource
    const buffer = new ArrayBuffer(content.length);
    const view = new Uint8Array(buffer);
    view.set(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 8);
}