/**
 * Vite config used exclusively for the Electron desktop build.
 * Key differences from the regular Replit config:
 *  - base: "./"  →  assets use relative paths (required for file:// protocol)
 *  - No PORT / BASE_PATH env vars required
 *  - No Replit-specific plugins
 *  - Output goes to dist/electron-app/
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/electron-app"),
    emptyOutDir: true,
  },
});
