// ============================================================================
// Example: runtime.config.ts - User configuration
// ============================================================================
import { cssPlugin } from "@oakseed/runtime/plugins/css.ts";
import { envPlugin } from "@oakseed/runtime/plugins/env.ts";
import { reactPlugin } from "@oakseed/runtime/plugins/react.ts";
import { sassPlugin } from "@oakseed/runtime/plugins/sass.ts";
import { errorOverlayPlugin } from "@oakseed/runtime/plugins/errorOverlay.ts";

export default {
  entry: "main.ts",
  
  server: {
    port: 3000,
    host: "localhost",
  },
  
  build: {
    outDir: "dist",
    splitting: true,
    external: [],
  },
  
  plugins: [
    cssPlugin(),
    sassPlugin(),
    envPlugin({
      prefix: "OAKSEED_",
    }),
    reactPlugin(),
    errorOverlayPlugin()
  ],
  
  // Mode-specific config
  development: {
    build: {
      sourcemap: true,
      minify: false,
    },
  },
  
  production: {
    build: {
      sourcemap: false,
      minify: true,
    },
  },
};