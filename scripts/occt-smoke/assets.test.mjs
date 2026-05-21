import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { getAssetMetrics } from "./assets.mjs";

describe("occt smoke asset metrics", () => {
  it("records and writes precompressed OCCT WASM assets", async () => {
    const root = await mkdtemp(join(tmpdir(), "partbench-occt-assets-"));

    try {
      const assetsDir = join(root, "assets");
      const wasmPath = join(assetsDir, "opencascade.full-test.wasm");
      await mkdir(assetsDir);
      await writeFile(wasmPath, Buffer.from("wasm payload wasm payload"));
      await writeFile(
        join(assetsDir, "geometryTessellation.worker-test.js"),
        "worker"
      );
      await writeFile(
        join(assetsDir, "geometry-worker-smoke-test.js"),
        "smoke"
      );

      const metrics = await getAssetMetrics(root);

      expect(metrics.occtWasmBytes).toBe(25);
      expect(metrics.occtWasmGzipBytes).toBeGreaterThan(0);
      expect(metrics.occtWasmBrotliBytes).toBeGreaterThan(0);
      expect(metrics.occtWasmBrotliQuality).toBe(9);
      await expect(stat(`${wasmPath}.gz`)).resolves.toBeTruthy();
      await expect(stat(`${wasmPath}.br`)).resolves.toBeTruthy();
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
