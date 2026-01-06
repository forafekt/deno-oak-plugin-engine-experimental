// ============================================================================
// plugins/sass.ts - Zero-dependency SCSS/SASS compiler
// ============================================================================
import { dirname, extname, join } from "@denoboot/x/std/path.ts";
import type { RuntimePlugin } from "../core/plugin.ts";

/**
 * Returns a plugin that compiles SCSS/SASS files to CSS.
 * @important This covers the most common use cases, but may not cover all of them. It is recommended to use a proper Sass loader in production. I need to think about this more.
 */
export function sassPlugin(): RuntimePlugin {
  return {
    name: "sass-plugin",

    esbuildPlugins() {
      return [
        {
          name: "sass-loader",
          setup(build) {
            console.log("sass-loader");

            build.onLoad({ filter: /\.(scss|sass)$/ }, async (args) => {
              console.log("sass-loader onLoad");
              const source = await Deno.readTextFile(args.path);

              const loader = new SassLoader(args.path);
              const css = await loader.load(source);

              if (build.initialOptions.write === false) {
                return {
                  loader: "js",
                  contents: `
                    const style = document.createElement("style");
                    style.textContent = ${JSON.stringify(css)};
                    document.head.appendChild(style);

                    if (import.meta.hot) {
                      import.meta.hot.accept();
                      import.meta.hot.dispose(() => style.remove());
                    }
                  `,
                };
              }

              return { loader: "css", contents: css };
            });
          },
        },
      ];
    },
  };
}

/**
 * This is a temporary Sass loader implementation.
 * It will be replaced with a proper Sass loader in the future.
 */
class SassLoader {
  private file: string;
  private vars = new Map<string, string>();

  constructor(file: string) {
    this.file = file;
  }

  async load(input: string): Promise<string> {
    const resolved = await this.resolveImports(input);
    const normalized = this.normalizeSyntax(resolved);
    return this.compile(normalized);
  }

  // --------------------------------------------------------------------------
  // @import resolution
  // --------------------------------------------------------------------------
  private async resolveImports(src: string): Promise<string> {
    const dir = dirname(this.file);

    return src.replace(/@import\s+["'](.+?)["'];?/g, (_, path) => {
      const full = join(dir, path);
      if (!Deno.statSync(full)) return "";
      return Deno.readTextFileSync(full);
    });
  }

  // --------------------------------------------------------------------------
  // Convert indented SASS → SCSS braces
  // --------------------------------------------------------------------------
  private normalizeSyntax(src: string): string {
    if (extname(this.file) !== ".sass") return src;

    const lines = src.split("\n");
    const out: string[] = [];
    const stack: number[] = [];

    for (const line of lines) {
      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      const text = line.trim();
      if (!text) continue;

      while (stack.length && indent < stack.at(-1)!) {
        out.push("}");
        stack.pop();
      }

      if (!text.includes(":")) {
        out.push(`${text} {`);
        stack.push(indent);
      } else {
        out.push(text + ";");
      }
    }

    while (stack.length) {
      out.push("}");
      stack.pop();
    }

    return out.join("\n");
  }

  // --------------------------------------------------------------------------
  // Core compiler
  // --------------------------------------------------------------------------
  private compile(src: string): string {
    src = this.stripComments(src);
    src = this.extractVariables(src);
    src = this.replaceVariables(src);
    return this.flattenSelectors(src);
  }

  private stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*/g, "");
  }

  private extractVariables(src: string): string {
    return src.replace(/\$([\w-]+)\s*:\s*(.+?);/g, (_, name, value) => {
      this.vars.set(name, value.trim());
      return "";
    });
  }

  private replaceVariables(src: string): string {
    for (const [key, value] of this.vars) {
      src = src.replace(new RegExp(`\\$${key}\\b`, "g"), value);
    }
    return src;
  }

  // --------------------------------------------------------------------------
  // Flatten nested selectors
  // --------------------------------------------------------------------------
  private flattenSelectors(src: string): string {
    const output: string[] = [];
    const stack: string[] = [];

    const tokens = src.split(/({|})/).map(t => t.trim()).filter(Boolean);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token === "{") continue;

      if (token === "}") {
        stack.pop();
        continue;
      }

      const next = tokens[i + 1];
      if (next === "{") {
        const parent = stack.at(-1);
        const selector = parent
          ? token.replace(/&/g, parent)
          : token;

        stack.push(selector);
        i++;
      } else {
        const selector = stack.at(-1);
        if (selector) {
          output.push(`${selector} { ${token} }`);
        }
      }
    }

    return output.join("\n");
  }
}
