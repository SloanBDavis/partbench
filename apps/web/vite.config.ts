import react from "@vitejs/plugin-react";
import { minify } from "terser";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { resolveDerivedGeometryFlags } from "./src/derivedGeometryFlags";

function minifyUiJavaScript(): Plugin {
  return {
    name: "partbench-minify-ui-javascript",
    async renderChunk(code, chunk) {
      if (chunk.isEntry && !chunk.facadeModuleId?.match(/[/\\]index\.html$/)) {
        return null;
      }

      const result = await minify(code, {
        compress: { passes: 2 },
        mangle: true,
        module: true,
        format: { comments: false }
      });
      if (!result.code) {
        throw new Error("Terser did not emit a UI JavaScript chunk.");
      }

      return { code: result.code, map: null };
    }
  };
}

function minifyCadCommandWorker(): Plugin {
  return {
    name: "partbench-minify-cad-command-worker",
    async renderChunk(code, chunk) {
      if (
        !chunk.isEntry ||
        !chunk.facadeModuleId?.match(/[/\\]cadCommand\.worker\.ts$/)
      ) {
        return null;
      }

      const result = await minify(code, {
        compress: { passes: 1 },
        mangle: true,
        module: true,
        format: { comments: false }
      });
      if (!result.code) {
        throw new Error("Terser did not emit the CAD command worker.");
      }

      return { code: result.code, map: null };
    }
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  const derivedGeometryFlags = resolveDerivedGeometryFlags({ command, env });
  const derivedGeometryRuntime = derivedGeometryFlags.enabled
    ? new URL("./src/derivedGeometryRuntime.browser.ts", import.meta.url)
        .pathname
    : new URL("./src/derivedGeometryRuntime.disabled.ts", import.meta.url)
        .pathname;
  const cadCoreRuntime = new URL(
    mode === "test"
      ? "../../packages/cad-core/src/index.ts"
      : "../../packages/cad-core/src/browser.ts",
    import.meta.url
  ).pathname;

  return {
    build: {
      rollupOptions: {
        output: {
          plugins: [minifyUiJavaScript()]
        }
      }
    },
    define: {
      __PARTBENCH_DERIVED_GEOMETRY_ENABLED__: JSON.stringify(
        derivedGeometryFlags.enabled
      )
    },
    resolve: {
      alias: [
        {
          find: /^@web-cad\/cad-core$/,
          replacement: cadCoreRuntime
        },
        {
          find: "@web-cad/derived-geometry-runtime",
          replacement: derivedGeometryRuntime
        }
      ]
    },
    plugins: [react()],
    worker: {
      rollupOptions: {
        output: {
          plugins: [minifyCadCommandWorker()]
        }
      }
    }
  };
});
