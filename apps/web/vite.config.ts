import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  const occtMeshDevRuntime =
    env.VITE_ENABLE_OCCT_MESH_DEV === "true"
      ? new URL("./src/occtMeshDevRuntime.ts", import.meta.url).pathname
      : new URL("./src/occtMeshDevRuntime.disabled.ts", import.meta.url)
          .pathname;

  return {
    define: {
      __WEB_CAD_OCCT_MESH_DEV__: JSON.stringify(
        env.VITE_ENABLE_OCCT_MESH_DEV === "true"
      )
    },
    resolve: {
      alias: {
        "@web-cad/occt-mesh-dev-runtime": occtMeshDevRuntime
      }
    },
    plugins: [react()]
  };
});
