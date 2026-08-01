import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const V21_PERFORMANCE_REPORT_VERSION = "partbench.v21-performance.v1";

const RESOURCE_LIMITS = {
  maxSelectedBodies: 256,
  maxSourceGraphNodes: 4_096,
  maxBrepArtifactBytes: 128 * 1024 * 1024,
  maxAggregateBrepArtifactBytes: 512 * 1024 * 1024,
  maxStepArtifactBytes: 512 * 1024 * 1024
};

export function auditV21Performance(record) {
  const failures = [];
  const proof = record?.metrics?.v21ExactInterchange;
  equal(failures, "browser record", record?.status, "ok");
  equal(
    failures,
    "browser scenario",
    record?.scenario,
    "v21-exact-interchange"
  );
  equal(failures, "workflow result", proof?.ok, true);
  equal(failures, "corpus body count", proof?.corpusBodyCount, 24);
  equal(failures, "artifact build count", proof?.artifactBuildCount, 46);
  equal(
    failures,
    "artifact evidence count",
    proof?.artifactEvidence?.length,
    24
  );
  if (
    !proof?.artifactEvidence?.every(
      ({ brepByteLength, brepSha256, solidCount }) =>
        brepByteLength > 0 &&
        /^[0-9a-f]{64}$/.test(brepSha256) &&
        solidCount > 0
    )
  ) {
    failures.push("artifact evidence is incomplete");
  }

  const corpus = proof?.corpusRoundTrip;
  equal(failures, "corpus schema", corpus?.schema, "AP242DIS");
  equal(failures, "corpus body count", corpus?.bodyCount, 24);
  equal(
    failures,
    "corpus invariant count",
    corpus?.exactInvariantBodyCount,
    24
  );
  equal(
    failures,
    "corpus re-import solid count",
    corpus?.reimportedSolidCount,
    29
  );
  equal(
    failures,
    "corpus duplicate names",
    corpus?.names?.[0],
    corpus?.names?.[1]
  );
  if (
    !corpus?.names?.some((name) =>
      [...name].some((character) => character.codePointAt(0) > 0x7f)
    )
  ) {
    failures.push("corpus Unicode name evidence is missing");
  }

  const expectedUnits = { mm: 1, cm: 10, m: 1_000, in: 25.4 };
  const units = Object.fromEntries(
    (proof?.unitRoundTrips ?? []).map((item) => [item.units, item])
  );
  for (const [unit, scale] of Object.entries(expectedUnits)) {
    equal(failures, `${unit} schema`, units[unit]?.schema, "AP242DIS");
    equal(failures, `${unit} body count`, units[unit]?.bodyCount, 5);
    equal(
      failures,
      `${unit} physical scale`,
      units[unit]?.physicalScaleToMillimetres,
      scale
    );
  }
  equal(
    failures,
    "checkpoint downstream count",
    proof?.checkpointRoundTrips?.exactInvariantBodyCount,
    6
  );
  equal(
    failures,
    "bounded workload body count",
    proof?.nearLimit?.bodyCount,
    16
  );
  maximum(
    failures,
    "bounded workload B-rep bytes",
    proof?.nearLimit?.aggregateBrepBytes,
    RESOURCE_LIMITS.maxAggregateBrepArtifactBytes
  );
  maximum(
    failures,
    "bounded workload STEP bytes",
    proof?.nearLimit?.stepByteLength,
    RESOURCE_LIMITS.maxStepArtifactBytes
  );
  if (!proof?.faults?.hashMismatchCode || !proof?.faults?.corruptStepCode) {
    failures.push("hash-mismatch and corrupt-STEP faults are required");
  }

  maximum(
    failures,
    "next-frame feedback",
    proof?.performance?.nextFrameFeedbackMs,
    34
  );
  maximum(
    failures,
    "main-thread long task",
    proof?.performance?.maxMainThreadLongTaskMs,
    50
  );
  equal(failures, "base64 calls", proof?.performance?.base64Calls, 0);
  equal(
    failures,
    "retained artifact bytes",
    proof?.performance?.retainedArtifactBytes,
    0
  );
  for (const [label, summary] of Object.entries({
    "artifact build": proof?.performance?.artifactBuildMs,
    writer: proof?.performance?.writerMs,
    "total export": proof?.performance?.totalExportMs,
    "STEP bytes": proof?.performance?.stepByteSizes
  })) {
    if (
      !Number.isFinite(summary?.p50) ||
      !Number.isFinite(summary?.p95) ||
      summary.p50 < 0 ||
      summary.p95 < summary.p50 ||
      summary.count < 1
    ) {
      failures.push(`${label} p50/p95 evidence is invalid`);
    }
  }
  if (!(proof?.performance?.workerRestartMs > 0)) {
    failures.push("worker restart timing is invalid");
  }
  for (const [key, expected] of Object.entries(RESOURCE_LIMITS)) {
    equal(
      failures,
      `resource limit ${key}`,
      proof?.resourceLimits?.[key],
      expected
    );
  }
  equal(
    failures,
    "OCCT WASM gzip bytes",
    record?.metrics?.occtWasmGzipBytes,
    13_808_536
  );
  return failures;
}

export function createV21PerformanceReport(record) {
  const failures = auditV21Performance(record);
  return {
    version: V21_PERFORMANCE_REPORT_VERSION,
    ok: failures.length === 0,
    status: failures.length === 0 ? "passed" : "failed",
    browserRecord: record,
    failures
  };
}

async function run() {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const metricsPath = join(repositoryRoot, ".metrics/v21-occt-browser.jsonl");
  const records = (await readFile(metricsPath, "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const record = records.findLast(
    ({ status, scenario }) =>
      status === "ok" && scenario === "v21-exact-interchange"
  );
  const report = createV21PerformanceReport(record);
  const outputPath = join(repositoryRoot, ".metrics/v21-performance.json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

function equal(failures, label, actual, expected) {
  if (actual !== expected) {
    failures.push(
      `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

function maximum(failures, label, actual, maximumValue) {
  if (!Number.isFinite(actual) || actual < 0 || actual > maximumValue) {
    failures.push(`${label}: ${actual} exceeds ${maximumValue}`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await run();
}
