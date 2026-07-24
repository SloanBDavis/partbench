import { describe, expect, it } from "vitest";

import {
  auditV19NearLimitProof,
  createV19PerformanceReport,
  V19_NEAR_LIMIT_DEFERRED,
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
      cancellationObserved: true
    },
    curveEdit: {
      completed: true,
      previewObserved: true,
      applyRevalidationObserved: true
    },
    interaction: {
      pointerFeedbackByNextAnimationFrame: true,
      frameIntervalP95Ms: 34,
      maxLongTaskMs: 50
    },
    workerDeferral: {
      occtWasmRequestCount: 0
    },
    ...overrides
  };
}

describe("V19 performance smoke gate", () => {
  it("reports the pre-Slice-E near-limit workload as deferred and not green", () => {
    const report = createV19PerformanceReport(
      inheritedV18(),
      V19_NEAR_LIMIT_DEFERRED
    );

    expect(report).toMatchObject({
      ok: false,
      status: "deferred",
      buildHash,
      nearLimit: {
        status: "deferred",
        requiredSlice: "E"
      }
    });
    expect(report.failures).toEqual([
      expect.stringContaining("deferred until Slice E")
    ]);
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
        cancellationObserved: false
      },
      interaction: {
        pointerFeedbackByNextAnimationFrame: false,
        frameIntervalP95Ms: 35,
        maxLongTaskMs: 51
      },
      workerDeferral: { occtWasmRequestCount: 1 }
    });

    expect(auditV19NearLimitProof(proof, buildHash)).toEqual([
      expect.stringContaining("proof build hash"),
      expect.stringContaining("proof execution"),
      expect.stringContaining("region cancellation"),
      expect.stringContaining("next-animation-frame pointer feedback"),
      expect.stringContaining("near-limit frame interval p95"),
      expect.stringContaining("near-limit long task"),
      expect.stringContaining("near-limit OCCT WASM requests")
    ]);
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
