import type { Plugin as EsBuildPlugin } from "@oakseed/x/esbuild.ts";
import { walkDir } from "../../../modules/utils.ts";

export const commentsRemover: EsBuildPlugin = {
  name: "comments-remover",
  setup(build) {
   // remove all comments from the output
   build.onEnd(async () => {
    const outdir = build.initialOptions.outdir;
    if (!outdir) return;
    
    for await (const file of walkDir(outdir, [".js", ".ts"])) {
      const content = await Deno.readTextFile(file);
      const newContent = content.replace(/\/\*.*?\*\//g, "");
      // const newContent = content.replace(/\/\*.*?\*\//g, "").replace(/\/\/.*?\n/g, "");
      await Deno.writeTextFile(file, newContent);
    }
   })
  }
};