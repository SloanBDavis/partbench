import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const V19_PERFORMANCE_REPORT_VERSION = "partbench.v19-performance.v1";
export const V19_NEAR_LIMIT_PROOF_VERSION =
  "partbench.v19-near-limit-performance.v1";
export const V19_NEAR_LIMIT_WORKLOAD_MODULE =
  "v19-near-limit-performance-workload.mjs";
export const V19_NEAR_LIMIT_EXPECTED_CANDIDATE_COUNT = 512;

export function auditV19NearLimitProof(proof, expectedBuildHash) {
  const failures = [];
  if (!isRecord(proof)) {
    return ["near-limit workload did not return a structured proof"];
  }
  checkEqual(
    failures,
    "proof version",
    proof.version,
    V19_NEAR_LIMIT_PROOF_VERSION
  );
  checkEqual(failures, "proof build hash", proof.buildHash, expectedBuildHash);
  checkEqual(
    failures,
    "proof execution",
    proof.execution,
    "production-browser"
  );
  checkEqual(failures, "proof result", proof.ok, true);
  checkEqual(
    failures,
    "near-limit classification",
    proof.nearLimitClass,
    "representative-near-limit"
  );
  checkBoolean(
    failures,
    "region discovery completion",
    proof.regionDiscovery?.completed
  );
  checkBoolean(
    failures,
    "complete region candidate set",
    proof.regionDiscovery?.candidateSetComplete
  );
  checkBoolean(
    failures,
    "region revision invalidation",
    proof.regionDiscovery?.revisionInvalidationObserved
  );
  checkBoolean(
    failures,
    "region cancellation",
    proof.regionDiscovery?.cancellationObserved
  );
  checkEqual(
    failures,
    "near-limit candidate limit",
    proof.regionDiscovery?.candidateLimit,
    V19_NEAR_LIMIT_EXPECTED_CANDIDATE_COUNT
  );
  checkEqual(
    failures,
    "near-limit candidate count",
    proof.regionDiscovery?.candidateCount,
    V19_NEAR_LIMIT_EXPECTED_CANDIDATE_COUNT
  );
  checkEqual(
    failures,
    "loaded near-limit candidate count",
    proof.regionDiscovery?.loadedCandidateCount,
    V19_NEAR_LIMIT_EXPECTED_CANDIDATE_COUNT
  );
  checkEqual(
    failures,
    "candidate count evidence source",
    proof.regionDiscovery?.candidateCountSource,
    "worker-query-response"
  );
  checkEqual(
    failures,
    "near-limit page count",
    proof.regionDiscovery?.pageCount,
    6
  );
  checkMinimum(
    failures,
    "physically cancelled query workers",
    proof.regionDiscovery?.cancelledQueryWorkerCount,
    1
  );
  checkMinimum(
    failures,
    "physical cancellation delay",
    proof.regionDiscovery?.cancellationDelayMs,
    Number.EPSILON
  );
  checkDistinctSourceRevisions(
    failures,
    proof.regionDiscovery?.initialSourceRevision,
    proof.regionDiscovery?.revisedSourceRevision
  );
  checkBoolean(failures, "curve edit completion", proof.curveEdit?.completed);
  checkBoolean(
    failures,
    "curve edit preview",
    proof.curveEdit?.previewObserved
  );
  checkBoolean(
    failures,
    "curve edit Apply revalidation",
    proof.curveEdit?.applyRevalidationObserved
  );
  checkEqual(
    failures,
    "curve edit Apply command",
    proof.curveEdit?.applyCommandOp,
    "sketch.split"
  );
  checkBoolean(
    failures,
    "revision-bound curve edit Apply",
    proof.curveEdit?.revisionBoundApply
  );
  checkBoolean(
    failures,
    "curve edit command response",
    proof.curveEdit?.commandResponseOk
  );
  checkBoolean(
    failures,
    "next-animation-frame pointer feedback",
    proof.interaction?.pointerFeedbackByNextAnimationFrame
  );
  checkBoolean(
    failures,
    "trusted pointer feedback event",
    proof.interaction?.trustedPointerFeedbackEvent
  );
  checkMaximum(
    failures,
    "trusted pointer feedback latency",
    proof.interaction?.pointerFeedbackFrameLatencyMs,
    34
  );
  checkBoolean(
    failures,
    "long-task observer support",
    proof.interaction?.longTaskObserverSupported
  );
  checkMinimum(
    failures,
    "near-limit frame samples",
    proof.interaction?.frameSampleCount,
    60
  );
  checkMaximum(
    failures,
    "near-limit frame interval p95",
    proof.interaction?.frameIntervalP95Ms,
    34
  );
  checkMaximum(
    failures,
    "near-limit long task",
    proof.interaction?.maxLongTaskMs,
    50
  );
  checkEqual(
    failures,
    "near-limit OCCT WASM requests",
    proof.workerDeferral?.occtWasmRequestCount,
    0
  );
  checkEqual(
    failures,
    "near-limit geometry worker requests",
    proof.workerDeferral?.geometryWorkerRequestCount,
    0
  );
  return failures;
}

export function createV19PerformanceReport(inheritedV18, nearLimit) {
  const failures = [];
  if (!isRecord(inheritedV18) || inheritedV18.ok !== true) {
    failures.push("the inherited V18 performance gate did not pass");
  }

  if (nearLimit?.status === "failed") {
    failures.push(
      nearLimit.reason ?? "the V19 near-limit workload did not produce proof"
    );
  } else {
    failures.push(
      ...auditV19NearLimitProof(nearLimit, inheritedV18?.buildHash)
    );
  }

  return {
    version: V19_PERFORMANCE_REPORT_VERSION,
    ok: failures.length === 0,
    status: failures.length === 0 ? "passed" : "failed",
    buildHash: inheritedV18?.buildHash,
    inheritedV18,
    nearLimit,
    failures
  };
}

async function runInheritedV18Performance(repositoryRoot) {
  const scriptPath = join(repositoryRoot, "scripts/smoke-v18-performance.mjs");
  const exitCode = await spawnAndWait(process.execPath, [scriptPath], {
    cwd: repositoryRoot,
    stdio: "inherit"
  });
  if (exitCode !== 0) {
    throw new Error(
      `The inherited V18 performance smoke exited with code ${exitCode}.`
    );
  }
  const report = JSON.parse(
    await readFile(
      join(repositoryRoot, ".metrics/v18-performance.json"),
      "utf8"
    )
  );
  if (report.ok !== true) {
    throw new Error("The inherited V18 performance report is not green.");
  }
  return report;
}

async function loadNearLimitProof(repositoryRoot, inheritedV18) {
  const modulePath = join(
    repositoryRoot,
    "scripts",
    V19_NEAR_LIMIT_WORKLOAD_MODULE
  );
  const exists = await stat(modulePath)
    .then((entry) => entry.isFile())
    .catch(() => false);
  if (!exists) {
    return {
      status: "failed",
      reason: `${V19_NEAR_LIMIT_WORKLOAD_MODULE} is missing.`
    };
  }

  const workload = await import(
    `${pathToFileURL(modulePath).href}?build=${encodeURIComponent(
      inheritedV18.buildHash
    )}`
  );
  if (typeof workload.runV19NearLimitPerformanceWorkload !== "function") {
    return {
      status: "failed",
      reason: `${V19_NEAR_LIMIT_WORKLOAD_MODULE} must export runV19NearLimitPerformanceWorkload.`
    };
  }
  return workload.runV19NearLimitPerformanceWorkload({
    repositoryRoot,
    buildHash: inheritedV18.buildHash
  });
}

async function run() {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const outputPath = join(repositoryRoot, ".metrics/v19-performance.json");
  let report;
  try {
    const inheritedV18 = await runInheritedV18Performance(repositoryRoot);
    const nearLimit = await loadNearLimitProof(repositoryRoot, inheritedV18);
    report = createV19PerformanceReport(inheritedV18, nearLimit);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    report = {
      version: V19_PERFORMANCE_REPORT_VERSION,
      ok: false,
      status: "failed",
      nearLimit: { status: "failed", reason },
      failures: [reason]
    };
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

function spawnAndWait(command, args, options) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, options);
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (signal) {
        rejectPromise(
          new Error(`Inherited performance smoke terminated by ${signal}.`)
        );
        return;
      }
      resolvePromise(code ?? 1);
    });
  });
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkEqual(failures, label, actual, expected) {
  if (actual !== expected) {
    failures.push(
      `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    );
  }
}

function checkBoolean(failures, label, actual) {
  checkEqual(failures, label, actual, true);
}

function checkMaximum(failures, label, actual, maximum) {
  if (!Number.isFinite(actual)) {
    failures.push(`${label}: expected a finite measurement`);
  } else if (actual > maximum) {
    failures.push(`${label}: ${actual}ms exceeds ${maximum}ms`);
  }
}

function checkMinimum(failures, label, actual, minimum) {
  if (!Number.isFinite(actual)) {
    failures.push(`${label}: expected a finite measurement`);
  } else if (actual < minimum) {
    failures.push(`${label}: ${actual} is below ${minimum}`);
  }
}

function checkDistinctSourceRevisions(failures, initial, revised) {
  const pattern = /^partbench-source-v1:[0-9a-f]{64}$/;
  if (
    typeof initial !== "string" ||
    typeof revised !== "string" ||
    !pattern.test(initial) ||
    !pattern.test(revised) ||
    initial === revised
  ) {
    failures.push(
      "region source revisions: expected two distinct canonical source revisions"
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await run();
}
