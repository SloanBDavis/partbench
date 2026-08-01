import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { measureV18Bundle } from "./v18-bundle-metrics.mjs";
import { auditV19Bundle, V19_BUNDLE_LIMITS } from "./v19-bundle-metrics.mjs";

export const V21_BUNDLE_LIMITS = V19_BUNDLE_LIMITS;
export const auditV21Bundle = auditV19Bundle;

function run() {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const metrics = measureV18Bundle(
    join(repositoryRoot, "apps/web/dist"),
    join(repositoryRoot, "apps/web/dist-geometry-worker-smoke")
  );
  const failures = auditV21Bundle(metrics);
  const report = {
    ...metrics,
    version: "partbench.v21-bundle.v1",
    release: "V21",
    ok: failures.length === 0,
    limits: V21_BUNDLE_LIMITS,
    failures
  };
  const outputPath = join(repositoryRoot, ".metrics/v21-bundle.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

  if (failures.length > 0) {
    throw new Error(`V21 bundle gate failed:\n- ${failures.join("\n- ")}`);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  run();
}
