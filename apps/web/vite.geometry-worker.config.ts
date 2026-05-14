import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "dist-geometry-worker-smoke",
    rollupOptions: {
      input: {
        "geometry-worker-smoke": "geometry-worker-smoke.html"
      }
    }
  }
});
