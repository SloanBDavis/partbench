import { readFile, stat, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const brotliQuality = 9;

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
  const wasmGzipBuffer = gzipSync(wasmBuffer);
  const wasmBrotliBuffer = brotliCompressSync(wasmBuffer, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: brotliQuality
    }
  });

  await writeFile(`${wasmPath}.gz`, wasmGzipBuffer);
  await writeFile(`${wasmPath}.br`, wasmBrotliBuffer);

  return {
    occtWasmBytes: wasmBuffer.byteLength,
    occtWasmGzipBytes: wasmGzipBuffer.byteLength,
    occtWasmBrotliBytes: wasmBrotliBuffer.byteLength,
    occtWasmBrotliQuality: brotliQuality,
    geometryWorkerBytes: (await stat(join(assetsDir, workerFile))).size,
    smokeBundleBytes: (await stat(join(assetsDir, smokeBundleFile))).size
  };
}
