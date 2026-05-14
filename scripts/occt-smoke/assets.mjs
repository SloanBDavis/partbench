import { readFile, stat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

export async function getAssetMetrics(rootDir) {
  const assetsDir = join(rootDir, "assets");
  const assets = await readdir(assetsDir);
  const wasmFile = assets.find((asset) =>
    asset.startsWith("opencascade.full-")
  );
  const workerFile = assets.find((asset) =>
    asset.startsWith("geometryTessellation.worker-")
  );
  const smokeBundleFile = assets.find(
    (asset) =>
      asset.startsWith("geometry-worker-smoke-") && asset.endsWith(".js")
  );

  if (!wasmFile || !workerFile || !smokeBundleFile) {
    throw new Error("Smoke build assets are missing expected OCCT files.");
  }

  const wasmPath = join(assetsDir, wasmFile);
  const wasmBuffer = await readFile(wasmPath);

  return {
    occtWasmBytes: wasmBuffer.byteLength,
    occtWasmGzipBytes: gzipSync(wasmBuffer).byteLength,
    geometryWorkerBytes: (await stat(join(assetsDir, workerFile))).size,
    smokeBundleBytes: (await stat(join(assetsDir, smokeBundleFile))).size
  };
}
