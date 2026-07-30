import { describe, expect, it } from "vitest";

import {
  auditV19NearLimitProof,
  createV19PerformanceReport,
  V19_NEAR_LIMIT_PROOF_VERSION
} from "./smoke-v19-performance.mjs";

const buildHash = "a".repeat(64);

function inheritedV18(overrides = {}) {
  return {
    ok: true,
    buildHash,
    shellReadyMedianMs: 100,
    interaction: {
      commandSearchP95Ms: 10,
      warmActionP95Ms: 20,
      frameIntervalP95Ms: 16,
      maxLongTaskMs: 0
    },
    ...overrides
  };
}

function validNearLimitProof(overrides = {}) {
  return {
    version: V19_NEAR_LIMIT_PROOF_VERSION,
    ok: true,
    buildHash,
    execution: "production-browser",
    nearLimitClass: "representative-near-limit",
    regionDiscovery: {
      completed: true,
      candidateSetComplete: true,
      revisionInvalidationObserved: true,
      cancellationObserved: true,
      candidateLimit: 512,
      candidateCount: 512,
      loadedCandidateCount: 512,
      candidateCountSource: "worker-query-response",
      pageCount: 6,
      cancelledQueryWorkerCount: 1,
      cancellationDelayMs: 16,
      initialSourceRevision: `partbench-source-v1:${"1".repeat(64)}`,
      revisedSourceRevision: `partbench-source-v1:${"2".repeat(64)}`
    },
    curveEdit: {
      completed: true,
      previewObserved: true,
      applyRevalidationObserved: true,
      applyCommandOp: "sketch.split",
      revisionBoundApply: true,
      commandResponseOk: true
    },
    interaction: {
      pointerFeedbackByNextAnimationFrame: true,
      trustedPointerFeedbackEvent: true,
      pointerFeedbackFrameLatencyMs: 34,
      longTaskObserverSupported: true,
      frameSampleCount: 120,
      frameIntervalP95Ms: 34,
      maxLongTaskMs: 50
    },
    workerDeferral: {
      geometryWorkerRequestCount: 0,
      occtWasmRequestCount: 0
    },
    ...overrides
  };
}

describe("V19 performance smoke gate", () => {
  it("fails when the near-limit workload cannot produce proof", () => {
    const report = createV19PerformanceReport(inheritedV18(), {
      status: "failed",
      reason: "near-limit workload is missing"
    });

    expect(report).toMatchObject({
      ok: false,
      status: "failed",
      buildHash,
      nearLimit: {
        status: "failed"
      }
    });
    expect(report.failures).toEqual(["near-limit workload is missing"]);
  });

  it("passes only with inherited V18 proof and complete live near-limit proof", () => {
    expect(
      createV19PerformanceReport(inheritedV18(), validNearLimitProof())
    ).toMatchObject({
      ok: true,
      status: "passed",
      buildHash,
      failures: []
    });
  });

  it("rejects stale or incomplete near-limit evidence", () => {
    const proof = validNearLimitProof({
      buildHash: "b".repeat(64),
      execution: "unit-test",
      regionDiscovery: {
        ...validNearLimitProof().regionDiscovery,
        cancellationObserved: false,
        cancelledQueryWorkerCount: 0
      },
      interaction: {
        pointerFeedbackByNextAnimationFrame: false,
        trustedPointerFeedbackEvent: false,
        pointerFeedbackFrameLatencyMs: 35,
        longTaskObserverSupported: false,
        frameSampleCount: 0,
        frameIntervalP95Ms: 35,
        maxLongTaskMs: 51
      },
      workerDeferral: {
        geometryWorkerRequestCount: 1,
        occtWasmRequestCount: 1
      }
    });

    expect(auditV19NearLimitProof(proof, buildHash)).toEqual([
      expect.stringContaining("proof build hash"),
      expect.stringContaining("proof execution"),
      expect.stringContaining("region cancellation"),
      expect.stringContaining("physically cancelled query workers"),
      expect.stringContaining("next-animation-frame pointer feedback"),
      expect.stringContaining("trusted pointer feedback event"),
      expect.stringContaining("trusted pointer feedback latency"),
      expect.stringContaining("long-task observer support"),
      expect.stringContaining("near-limit frame samples"),
      expect.stringContaining("near-limit frame interval p95"),
      expect.stringContaining("near-limit long task"),
      expect.stringContaining("near-limit OCCT WASM requests"),
      expect.stringContaining("near-limit geometry worker requests")
    ]);
  });

  it("rejects boolean-only evidence without observed query and Apply details", () => {
    const proof = validNearLimitProof({
      regionDiscovery: {
        completed: true,
        candidateSetComplete: true,
        revisionInvalidationObserved: true,
        cancellationObserved: true
      },
      curveEdit: {
        completed: true,
        previewObserved: true,
        applyRevalidationObserved: true
      }
    });

    expect(auditV19NearLimitProof(proof, buildHash)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("near-limit candidate limit"),
        expect.stringContaining("candidate count evidence source"),
        expect.stringContaining("physically cancelled query workers"),
        expect.stringContaining("region source revisions"),
        expect.stringContaining("curve edit Apply command"),
        expect.stringContaining("revision-bound curve edit Apply"),
        expect.stringContaining("curve edit command response")
      ])
    );
  });

  it("never masks a failed inherited V18 performance gate", () => {
    const report = createV19PerformanceReport(
      inheritedV18({ ok: false }),
      validNearLimitProof()
    );

    expect(report.ok).toBe(false);
    expect(report.status).toBe("failed");
    expect(report.failures).toEqual([
      expect.stringContaining("inherited V18 performance gate")
    ]);
  });
});
