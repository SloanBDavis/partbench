import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { resolveDerivedGeometryFlags } from "./src/derivedGeometryFlags";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  const derivedGeometryFlags = resolveDerivedGeometryFlags({ command, env });
  const derivedGeometryRuntime = derivedGeometryFlags.enabled
    ? new URL("./src/derivedGeometryRuntime.browser.ts", import.meta.url)
        .pathname
    : new URL("./src/derivedGeometryRuntime.disabled.ts", import.meta.url)
        .pathname;

  return {
    define: {
      __PARTBENCH_DERIVED_GEOMETRY_ENABLED__: JSON.stringify(
        derivedGeometryFlags.enabled
      )
    },
    resolve: {
      alias: {
        "@web-cad/derived-geometry-runtime": derivedGeometryRuntime
      }
    },
    plugins: [react()]
  };
});
