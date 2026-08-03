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
      if (code.trim().length === 0) return null;

      const options = {
        compress: { passes: chunk.isEntry ? 2 : 3 },
        mangle: true,
        module: true,
        format: { comments: false, quote_style: 1 }
      } as const;
      const result = await minify(code, options);
      if (!result.code) {
        throw new Error("Terser did not emit a UI JavaScript chunk.");
      }

      return { code: result.code, map: null };
    }
  };
}

const cadCommandWorkerIdentifierMangler = {
  get(index: number): string {
    const characters =
      "teniroasdculpfyhgImvEkSbRT_CxANODPFVLMw$BKUHjqGYzJWXZQ0123456789";
    let identifier = "";
    let base = 54;
    index += 1;
    do {
      index -= 1;
      identifier += characters[index % base];
      index = Math.floor(index / base);
      base = 64;
    } while (index > 0);
    return identifier;
  }
};

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
        compress: {
          comparisons: false,
          lhs_constants: false,
          passes: 1,
          reduce_vars: false,
          sequences: false
        },
        mangle: { nth_identifier: cadCommandWorkerIdentifierMangler },
        module: true,
        format: { comments: false, quote_style: 1 }
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
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          onlyExplicitManualChunks: true,
          manualChunks(id, { getModuleInfo }) {
            if (/[/\\]ui[/\\]NumericInput\.tsx(?:\?|$)/.test(id)) {
              return "deferred-ui";
            }
            const seen = new Set<string>();
            const isEntryDependency = (moduleId: string): boolean => {
              if (seen.has(moduleId)) return false;
              seen.add(moduleId);
              const info = getModuleInfo(moduleId);
              return Boolean(
                info?.isEntry ||
                info?.importers.some((importer) => isEntryDependency(importer))
              );
            };

            return /\.[cm]?[jt]sx?(?:\?|$)/.test(id) && !isEntryDependency(id)
              ? "deferred-ui"
              : undefined;
          },
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
