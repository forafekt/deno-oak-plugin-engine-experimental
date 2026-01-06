// ============================================================================
// cli/args.ts - Argument parsing
// ============================================================================
import { parseArgs } from "@denoboot/x/std/cli.ts";

type EnvMode = "development" | "production";

export interface ParsedArgs {
  _: (string | number)[];
  root?: string;
  config?: string;
  port?: number;
  host?: string;
  mode?: EnvMode;
  hmr?: boolean;
}

export function parseCliArgs(args: string[]): ParsedArgs {
  const parsed = parseArgs(args, {
    string: ["root", "config", "host", "mode"],
    boolean: ["hmr"],
    default: {
      hmr: true,
    },
  });

  return {
    _: parsed._,
    root: parsed.root,
    config: parsed.config,
    port: parsed.port ? Number(parsed.port) : undefined,
    host: parsed.host,
    mode: parsed.mode as EnvMode | undefined,
    hmr: parsed.hmr,
  };
}