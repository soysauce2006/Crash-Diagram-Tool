/**
 * Vite config for the self-hosted web server build.
 * Differences from the Replit dev config:
 *  - base: "/"  →  served from the root of a domain/subdomain
 *  - No PORT / BASE_PATH env vars required
 *  - No Replit-specific plugins
 *  - Output goes to dist/webapp/
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/webapp"),
    emptyOutDir: true,
  },
});
