import type { Plugin as EsBuildPlugin } from "@oakseed/x/esbuild.ts";

export const dependencyScanner: EsBuildPlugin = {
  name: "dependency-scanner",
  setup(build) {
    const deps = new Set<string>();

    build.onResolve({ filter: /.*/ }, args => {
      if (
        !args.path.startsWith(".") &&
        !args.path.startsWith("/") &&
        !args.path.startsWith("file:")
      ) {
        deps.add(args.path);
        return { external: true };
      }
    });

    build.onEnd(() => {
      // Write import-map.json here
      const importMap = {
        imports: Object.fromEntries(deps.entries()),
      };
      let outdir = build.initialOptions.outdir;

      if (outdir?.endsWith("/")) {
        outdir = outdir.slice(0, -1);
      }
      
      Deno.writeTextFile(`${outdir}/import-map.json`, JSON.stringify(importMap, null, 2));
    });
  }
};