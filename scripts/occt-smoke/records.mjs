import { createSmokeErrorDetails } from "./errors.mjs";

export function assertSmokeResult(record) {
  const { metrics } = record;
  const timingKeys = [
    "occtLoadMs",
    "tessellationMs",
    "geometryKernelMs",
    "workerExecutionMs",
    "roundTripMs"
  ];
  const sizeKeys = [
    "occtWasmBytes",
    "occtWasmGzipBytes",
    "occtWasmBrotliBytes",
    "occtWasmBrotliQuality",
    "occtWasmServedBytes"
  ];

  if (record.status !== "ok") {
    throw new Error(record.error?.message ?? "OCCT browser smoke failed.");
  }

  if (record.worker.wasmLoadStatus !== "loaded") {
    throw new Error(
      `Unexpected worker WASM load status: ${record.worker.wasmLoadStatus}.`
    );
  }

  if (metrics.vertexCount !== 24 || metrics.triangleCount !== 12) {
    throw new Error(
      `Unexpected mesh size: ${metrics.vertexCount} vertices, ${metrics.triangleCount} triangles.`
    );
  }

  const cylinder = metrics.meshes?.find(
    (mesh) => mesh.primitive === "cylinder"
  );

  if (!cylinder) {
    throw new Error("Missing cylinder tessellation smoke result.");
  }

  if (cylinder.vertexCount <= 0 || cylinder.triangleCount <= 0) {
    throw new Error(
      `Unexpected cylinder mesh size: ${cylinder.vertexCount} vertices, ${cylinder.triangleCount} triangles.`
    );
  }

  const sphere = metrics.meshes?.find((mesh) => mesh.primitive === "sphere");

  if (!sphere) {
    throw new Error("Missing sphere tessellation smoke result.");
  }

  if (sphere.vertexCount <= 0 || sphere.triangleCount <= 0) {
    throw new Error(
      `Unexpected sphere mesh size: ${sphere.vertexCount} vertices, ${sphere.triangleCount} triangles.`
    );
  }

  for (const primitive of ["cone", "torus"]) {
    const mesh = metrics.meshes?.find((item) => item.primitive === primitive);

    if (!mesh) {
      throw new Error(`Missing ${primitive} tessellation smoke result.`);
    }

    if (mesh.vertexCount <= 0 || mesh.triangleCount <= 0) {
      throw new Error(
        `Unexpected ${primitive} mesh size: ${mesh.vertexCount} vertices, ${mesh.triangleCount} triangles.`
      );
    }
  }

  for (const key of timingKeys) {
    if (!Number.isFinite(metrics[key])) {
      throw new Error(`Missing or invalid timing metric: ${key}.`);
    }
  }

  for (const key of sizeKeys) {
    if (!Number.isFinite(metrics[key])) {
      throw new Error(`Missing or invalid OCCT size metric: ${key}.`);
    }
  }

  if (metrics.occtWasmServedEncoding !== "br") {
    throw new Error(
      `Unexpected OCCT WASM served encoding: ${metrics.occtWasmServedEncoding}.`
    );
  }

  if (metrics.occtWasmServedBytes > metrics.occtWasmGzipBytes) {
    throw new Error("OCCT WASM served bytes exceeded gzip size.");
  }
}

export function createSuccessRecord(input) {
  const diagnostics = input.smokeResult.diagnostics;

  return {
    schemaVersion: 1,
    status: "ok",
    timestamp: input.timestamp ?? new Date().toISOString(),
    gitSha: input.gitSha,
    nodeVersion: input.nodeVersion ?? process.version,
    scenario: input.scenarioName,
    appUrl: input.appUrl,
    browser: createBrowserRecord(input),
    worker: {
      startup: diagnostics?.workerStarted ? "started" : "unknown",
      wasmLoadStatus: diagnostics?.wasmLoadStatus ?? "unknown",
      diagnostics
    },
    metrics: {
      ...input.assetMetrics,
      occtLoadMs: input.smokeResult.timings.occtLoadMs,
      tessellationMs: input.smokeResult.timings.tessellationMs,
      geometryKernelMs: input.smokeResult.timings.geometryKernelMs,
      workerExecutionMs: input.smokeResult.timings.workerExecutionMs,
      roundTripMs: input.smokeResult.timings.roundTripMs,
      vertexCount: input.smokeResult.vertexCount,
      triangleCount: input.smokeResult.triangleCount,
      meshes: input.smokeResult.meshes
    }
  };
}

export function createFailureRecord(input) {
  const error = createSmokeErrorDetails(input.error);

  return {
    schemaVersion: 1,
    status: "error",
    timestamp: input.timestamp ?? new Date().toISOString(),
    gitSha: undefined,
    nodeVersion: input.nodeVersion ?? process.version,
    scenario: input.scenarioName,
    appUrl: input.appUrl,
    browser: createBrowserRecord(input),
    worker: {
      startup: error.workerStarted ? "started" : "notStarted",
      wasmLoadStatus: error.wasmLoadStatus,
      diagnostics: undefined
    },
    ...(input.assetMetrics ? { metrics: input.assetMetrics } : {}),
    error
  };
}

export function printSummary(record, metricsPath) {
  const { metrics } = record;

  console.log("OCCT browser smoke passed");
  console.log(`metrics: ${metricsPath}`);
  console.log(`scenario: ${record.scenario}`);
  console.log(`browser: ${record.browser.name ?? record.browser.executable}`);
  console.log(
    `worker: ${record.worker.startup}, wasm ${record.worker.wasmLoadStatus}`
  );
  console.log(`OCCT load: ${formatMs(metrics.occtLoadMs)}`);
  console.log(`tessellation: ${formatMs(metrics.tessellationMs)}`);
  console.log(`worker total: ${formatMs(metrics.workerExecutionMs)}`);
  console.log(`round trip: ${formatMs(metrics.roundTripMs)}`);
  console.log(
    `mesh: ${metrics.vertexCount} vertices, ${metrics.triangleCount} triangles`
  );

  if (metrics.meshes?.length) {
    console.log(
      `meshes: ${metrics.meshes
        .map(
          (mesh) =>
            `${mesh.primitive} ${mesh.vertexCount} vertices/${mesh.triangleCount} triangles`
        )
        .join(", ")}`
    );
  }
  console.log(
    `OCCT WASM: ${formatBytes(metrics.occtWasmBytes)} raw, ${formatBytes(
      metrics.occtWasmGzipBytes
    )} gzip, ${formatBytes(metrics.occtWasmBrotliBytes)} br`
  );
  if (metrics.occtWasmTransferredBytes) {
    console.log(
      `OCCT transfer: ${formatBytes(metrics.occtWasmTransferredBytes)} via ${
        metrics.occtWasmTransferEncoding ?? "unknown"
      }`
    );
  }
  if (metrics.occtWasmServedBytes) {
    console.log(
      `OCCT served: ${formatBytes(metrics.occtWasmServedBytes)} via ${
        metrics.occtWasmServedEncoding ?? "unknown"
      }`
    );
  }
}

export function printFailureSummary(record, metricsPath) {
  console.error("OCCT browser smoke failed");
  console.error(`metrics: ${metricsPath}`);
  console.error(`scenario: ${record.scenario}`);
  console.error(`browser: ${record.browser.name ?? record.browser.executable}`);
  console.error(
    `worker: ${record.worker.startup}, wasm ${record.worker.wasmLoadStatus}`
  );
  console.error(`error: ${record.error.code} at ${record.error.stage}`);
  console.error(record.error.message);

  if (record.metrics?.occtWasmBytes) {
    console.error(
      `OCCT WASM: ${formatBytes(record.metrics.occtWasmBytes)} raw, ${formatBytes(
        record.metrics.occtWasmGzipBytes
      )} gzip, ${formatBytes(record.metrics.occtWasmBrotliBytes)} br`
    );
  }
}

export function createBrowserRecord(input) {
  return {
    executable: input.browserExecutable,
    remoteDebuggingPort: input.remoteDebuggingPort,
    name: input.browserVersion?.Browser,
    userAgent: input.browserVersion?.["User-Agent"],
    protocolVersion: input.browserVersion?.["Protocol-Version"]
  };
}

export function formatMs(value) {
  return `${value.toFixed(value < 10 ? 2 : 1)} ms`;
}

export function formatBytes(value) {
  return `${(value / 1_000_000).toFixed(2)} MB`;
}
