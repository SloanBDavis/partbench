import { describe, expect, it } from "vitest";

import {
  createNearLimitCircleDefinitions,
  deriveV19NearLimitProof,
  measureCancellationDelay,
  V19_NEAR_LIMIT_CANDIDATE_COUNT,
  V19_NEAR_LIMIT_PROOF_VERSION
} from "./v19-near-limit-performance-workload.mjs";

const buildHash = "a".repeat(64);

function completeBrowserEvidence(overrides = {}) {
  return {
    regionDiscovery: {
      status: "ready",
      candidateCount: V19_NEAR_LIMIT_CANDIDATE_COUNT,
      candidateCountSource: "worker-query-response",
      loadedCandidateCount: V19_NEAR_LIMIT_CANDIDATE_COUNT,
      hasMore: false,
      pageCount: 6,
      initialAreaLabel: "0.7854²",
      revisedStatus: "ready",
      revisedAreaLabel: "0.6362²",
      initialQueryWorkerCount: 7,
      revisedQueryWorkerCount: 8,
      initialSourceRevision: `partbench-source-v1:${"1".repeat(64)}`,
      revisedSourceRevision: `partbench-source-v1:${"2".repeat(64)}`
    },
    curveEdit: {
      editorClosed: true,
      previewObserved: true,
      applyCommandOp: "sketch.split",
      revisionBoundApply: true,
      commandResponseOk: true,
      entityCountBefore: 513,
      entityCountAfter: 514
    },
    interaction: {
      pointerFeedbackByNextAnimationFrame: true,
      trustedPointerFeedbackEvent: true,
      pointerFeedbackFrameLatencyMs: 16,
      frameIntervalP95Ms: 20,
      maxLongTaskMs: 0,
      longTaskObserverSupported: true,
      frameSampleCount: 120
    },
    workers: { cancelledQueryWorkerCount: 1, cancellationDelayMs: 16 },
    workerUrls: ["http://127.0.0.1/assets/cadCommand.worker-example.js"],
    occtWasmRequests: [],
    failures: [],
    ...overrides
  };
}

describe("V19 near-limit production-browser workload", () => {
  it("constructs the exact candidate-cap fixture without touching boundaries", () => {
    const circles = createNearLimitCircleDefinitions(0.5);

    expect(circles).toHaveLength(V19_NEAR_LIMIT_CANDIDATE_COUNT);
    expect(new Set(circles.map((circle) => circle.id)).size).toBe(
      V19_NEAR_LIMIT_CANDIDATE_COUNT
    );
    expect(circles.every((circle) => circle.radius * 2 < 3)).toBe(true);
    expect(
      circles.every((circle, index) => {
        const column = index % 32;
        const row = Math.floor(index / 32);
        return (
          circle.center[0] === column * 3 - 46.5 &&
          circle.center[1] === row * 3 - 22.5
        );
      })
    ).toBe(true);
  });

  it("measures cancellation from the request, not the earlier query post", () => {
    expect(
      measureCancellationDelay([
        {
          queryPostedAt: 5,
          cancellationRequestedAt: 20,
          terminatedAt: 25
        }
      ])
    ).toBe(5);
  });

  it("derives a passing proof only from complete observed browser evidence", () => {
    expect(
      deriveV19NearLimitProof({
        buildHash,
        browserEvidence: completeBrowserEvidence()
      })
    ).toMatchObject({
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
        candidateCount: 512,
        loadedCandidateCount: 512,
        cancelledQueryWorkerCount: 1
      },
      curveEdit: {
        completed: true,
        previewObserved: true,
        applyRevalidationObserved: true
      },
      interaction: {
        pointerFeedbackByNextAnimationFrame: true,
        frameIntervalP95Ms: 20,
        maxLongTaskMs: 0
      },
      workerDeferral: {
        geometryWorkerRequestCount: 0,
        occtWasmRequestCount: 0
      },
      failures: []
    });
  });

  it("fails closed for partial pages, response-before-termination, stale cache, or deferred workers", () => {
    const evidence = completeBrowserEvidence({
      regionDiscovery: {
        ...completeBrowserEvidence().regionDiscovery,
        loadedCandidateCount: 500,
        revisedAreaLabel: "0.7854²",
        revisedQueryWorkerCount: 7
      },
      workers: { cancelledQueryWorkerCount: 0 },
      workerUrls: [
        "http://127.0.0.1/assets/geometryTessellation.worker-example.js"
      ],
      occtWasmRequests: ["http://127.0.0.1/opencascade.full.wasm"]
    });
    const proof = deriveV19NearLimitProof({
      buildHash,
      browserEvidence: evidence
    });

    expect(proof.ok).toBe(false);
    expect(proof.regionDiscovery).toMatchObject({
      candidateSetComplete: false,
      revisionInvalidationObserved: false,
      cancellationObserved: false
    });
    expect(proof.workerDeferral.occtWasmRequestCount).toBe(1);
    expect(proof.workerDeferral.geometryWorkerRequestCount).toBe(1);
    expect(proof.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("complete 512-candidate set"),
        expect.stringContaining("revision invalidation"),
        expect.stringContaining("terminated before its response"),
        expect.stringContaining("OCCT WASM"),
        expect.stringContaining("geometry worker")
      ])
    );
  });

  it("fails closed when next-frame feedback arrives outside the frame budget", () => {
    const evidence = completeBrowserEvidence({
      interaction: {
        ...completeBrowserEvidence().interaction,
        pointerFeedbackFrameLatencyMs: 35
      }
    });
    const proof = deriveV19NearLimitProof({
      buildHash,
      browserEvidence: evidence
    });

    expect(proof.ok).toBe(false);
    expect(proof.failures).toContain(
      "trusted pointer feedback latency exceeded 34ms"
    );
  });
});
