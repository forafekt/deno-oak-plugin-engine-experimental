import * as esbuild from "@oakseed/x/esbuild.ts";

const reloadListeners = new Set<() => void>();

export function onReload(fn: () => void) {
  reloadListeners.add(fn);
}

export const hmrPlugin: esbuild.Plugin = {
  name: "hmr",
  setup(build) {
    build.onEnd(result => {
      if (!result.errors.length) {
        for (const fn of reloadListeners) fn();
      }
    });
  }
};

