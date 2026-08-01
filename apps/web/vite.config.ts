import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import type { MinifyOptions } from "terser";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { resolveDerivedGeometryFlags } from "./src/derivedGeometryFlags";

const terserPath = createRequire(import.meta.url).resolve("terser");

function minifyInWorker(code: string, options: MinifyOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(
      `const { parentPort, workerData } = require("node:worker_threads");
       require(workerData.terserPath).minify(workerData.code, workerData.options)
         .then((result) => parentPort.postMessage({ code: result.code }))
         .catch((error) => parentPort.postMessage({ error: error?.stack ?? String(error) }));`,
      { eval: true, workerData: { code, options, terserPath } }
    );
    worker.once("message", (message: { code?: string; error?: string }) => {
      settled = true;
      if (message.error) reject(new Error(message.error));
      else if (message.code) resolve(message.code);
      else reject(new Error("Terser did not emit JavaScript."));
    });
    worker.once("error", (error) => {
      settled = true;
      reject(error);
    });
    worker.once("exit", (exitCode) => {
      if (!settled) {
        reject(
          new Error(
            `Terser worker exited with code ${exitCode} without output.`
          )
        );
      }
    });
  });
}

function minifyUiJavaScript(): Plugin {
  return {
    name: "partbench-minify-ui-javascript",
    async renderChunk(code, chunk) {
      if (chunk.isEntry && !chunk.facadeModuleId?.match(/[/\\]index\.html$/)) {
        return null;
      }

      const result = await minifyInWorker(code, {
        compress: { passes: 2 },
        mangle: true,
        module: true,
        format: { comments: false }
      });
      return { code: result, map: null };
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

      const result = await minifyInWorker(code, {
        compress: { passes: 1 },
        mangle: true,
        module: true,
        format: { comments: false }
      });
      return { code: result, map: null };
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
