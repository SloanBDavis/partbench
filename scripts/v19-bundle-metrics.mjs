import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { measureV18Bundle } from "./v18-bundle-metrics.mjs";

export const V19_BUNDLE_LIMITS = Object.freeze({
  criticalJavaScriptGzipBytes: 400 * 1024,
  criticalCssGzipBytes: 20 * 1024,
  allUiJavaScriptGzipBytes: 550 * 1024,
  commandWorkerGzipBytes: 256 * 1024,
  geometryWorkerGzipBytes: 120 * 1024,
  occtWasmGzipBytes: 13_808_536
});

const AUDITED_ARTIFACTS = Object.freeze([
  ["critical JavaScript", "criticalJavaScript", "criticalJavaScriptGzipBytes"],
  ["critical CSS", "criticalCss", "criticalCssGzipBytes"],
  ["all UI JavaScript", "allUiJavaScript", "allUiJavaScriptGzipBytes"],
  ["command worker", "commandWorker", "commandWorkerGzipBytes"],
  ["geometry worker", "geometryWorker", "geometryWorkerGzipBytes"],
  ["OCCT WASM", "occtWasm", "occtWasmGzipBytes"]
]);

export function auditV19Bundle(metrics) {
  const failures = [];
  for (const [label, metricKey, limitKey] of AUDITED_ARTIFACTS) {
    const measured = metrics[metricKey]?.gzipBytes;
    if (!Number.isFinite(measured) || measured <= 0) {
      failures.push(`${label}: expected an emitted artifact but measured none`);
      continue;
    }
    const maximum = V19_BUNDLE_LIMITS[limitKey];
    if (measured > maximum) {
      failures.push(`${label}: ${measured} gzip bytes exceeds ${maximum}`);
    }
  }
  return failures;
}

function run() {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const metrics = measureV18Bundle(
    join(repositoryRoot, "apps/web/dist"),
    join(repositoryRoot, "apps/web/dist-geometry-worker-smoke")
  );
  const failures = auditV19Bundle(metrics);
  const report = {
    ...metrics,
    version: "partbench.v19-bundle.v1",
    release: "V19",
    ok: failures.length === 0,
    limits: V19_BUNDLE_LIMITS,
    failures
  };
  const outputPath = join(repositoryRoot, ".metrics/v19-bundle.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

  if (failures.length > 0) {
    throw new Error(`V19 bundle gate failed:\n- ${failures.join("\n- ")}`);
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  run();
}
