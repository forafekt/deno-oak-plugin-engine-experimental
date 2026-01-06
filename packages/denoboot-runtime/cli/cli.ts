// runtime/cli/cli.ts
import { Args } from "@denoboot/x/std/cli.ts";
import { createRuntime } from "../core/runtime.ts";
import { parseCliArgs } from "./args.ts";
import { shutdownEsbuild } from "../build/builder.ts";

const commands = {
  async dev(args: Args) {
    const runtime = createRuntime({
      root: args.root ?? Deno.cwd(),
      mode: "development",
      config: args.config,
      hmr: args.hmr !== false,
    });

    await runtime.start();

    // Keep alive and handle signals
    const ac = new AbortController();
    Deno.addSignalListener("SIGINT", () => ac.abort());
    Deno.addSignalListener("SIGTERM", () => ac.abort());

    try {
    await new Promise((_, reject) => {
      ac.signal.addEventListener("abort", () =>
        reject(new Error("shutdown"))
      );
    });
  } catch {
    // ignore
    Deno.exit(1);
  } finally {
    await runtime.stop();
    await shutdownEsbuild();
    Deno.exit(0);
  }
  },

  async build(args: Args) {
    const runtime = createRuntime({
      root: args.root ?? Deno.cwd(),
      mode: "production",
      config: args.config,
      hmr: false,
    });

    try {
      const result = await runtime.build();
      console.log(`Built in ${result.duration}ms`);
      if (result.errors.length > 0) {
        Deno.exit(1);
      }
    } finally {
      await runtime.stop();
      await shutdownEsbuild();
      Deno.exit(0);
    }
  },

  async preview(args: Args) {
    const runtime = createRuntime({
      root: args.root ?? Deno.cwd(),
      mode: "production",
      config: args.config,
      hmr: false,
    });

    await runtime.build();
    await runtime.start(); // Starts static server

    // Same signal handling as dev
  },
};

if (import.meta.main) {
  const args = parseCliArgs(Deno.args);
  commands[args._[0] as keyof typeof commands](args);
}

export default commands;
