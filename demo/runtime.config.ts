import { defineRuntimeConfig } from "@oakseed/runtime";

export default defineRuntimeConfig({
  root: Deno.cwd(),
  build: {
    outDir: "./.out",
    splitting: true,
    sourcemap: true,
    minify: false,
  },
  server: {
    port: 8001,
    host: "localhost",
  },
  hmr: {
    port: 24678,
    host: "localhost",
  },
  plugins: [],
});