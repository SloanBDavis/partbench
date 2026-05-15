import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { resolveDerivedGeometryFlags } from "./src/derivedGeometryFlags";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  const derivedGeometryFlags = resolveDerivedGeometryFlags({ command, env });
  const occtMeshDevRuntime = derivedGeometryFlags.enabled
    ? new URL("./src/occtMeshDevRuntime.ts", import.meta.url).pathname
    : new URL("./src/occtMeshDevRuntime.disabled.ts", import.meta.url).pathname;

  return {
    define: {
      __WEB_CAD_DERIVED_GEOMETRY_ENABLED__: JSON.stringify(
        derivedGeometryFlags.enabled
      ),
      __WEB_CAD_OCCT_MESH_DEV__: JSON.stringify(derivedGeometryFlags.enabled)
    },
    resolve: {
      alias: {
        "@web-cad/occt-mesh-dev-runtime": occtMeshDevRuntime
      }
    },
    plugins: [react()]
  };
});
