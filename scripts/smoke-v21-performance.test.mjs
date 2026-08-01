import { describe, expect, it } from "vitest";

import { auditV21Performance } from "./smoke-v21-performance.mjs";

function validRecord() {
  const summary = { count: 1, p50: 1, p95: 1, max: 1 };
  return {
    status: "ok",
    scenario: "v21-exact-interchange",
    metrics: {
      occtWasmGzipBytes: 13_808_536,
      v21ExactInterchange: {
        ok: true,
        corpusBodyCount: 24,
        artifactBuildCount: 46,
        artifactEvidence: Array.from({ length: 24 }, () => ({
          brepByteLength: 1,
          brepSha256: "a".repeat(64),
          solidCount: 1
        })),
        corpusRoundTrip: {
          schema: "AP242DIS",
          bodyCount: 24,
          exactInvariantBodyCount: 24,
          reimportedSolidCount: 29,
          names: ["Duplicate Ω", "Duplicate Ω"]
        },
        unitRoundTrips: Object.entries({
          mm: 1,
          cm: 10,
          m: 1_000,
          in: 25.4
        }).map(([units, physicalScaleToMillimetres]) => ({
          units,
          schema: "AP242DIS",
          bodyCount: 5,
          physicalScaleToMillimetres
        })),
        checkpointRoundTrips: { exactInvariantBodyCount: 6 },
        nearLimit: { bodyCount: 16, aggregateBrepBytes: 1, stepByteLength: 1 },
        faults: {
          hashMismatchCode: "INVALID_DIMENSIONS",
          corruptStepCode: "KERNEL_FAILURE"
        },
        performance: {
          nextFrameFeedbackMs: 1,
          maxMainThreadLongTaskMs: 0,
          base64Calls: 0,
          retainedArtifactBytes: 0,
          artifactBuildMs: summary,
          writerMs: summary,
          totalExportMs: summary,
          stepByteSizes: summary,
          workerRestartMs: 1
        },
        resourceLimits: {
          maxSelectedBodies: 256,
          maxSourceGraphNodes: 4_096,
          maxBrepArtifactBytes: 128 * 1024 * 1024,
          maxAggregateBrepArtifactBytes: 512 * 1024 * 1024,
          maxStepArtifactBytes: 512 * 1024 * 1024
        }
      }
    }
  };
}

describe("V21 performance smoke", () => {
  it("accepts complete real-browser evidence at the fixed limits", () => {
    expect(auditV21Performance(validRecord())).toEqual([]);
  });

  it("rejects missing responsiveness, memory, corpus, and bundle evidence", () => {
    const record = validRecord();
    record.metrics.occtWasmGzipBytes += 1;
    record.metrics.v21ExactInterchange.corpusBodyCount = 23;
    record.metrics.v21ExactInterchange.performance.base64Calls = 1;
    record.metrics.v21ExactInterchange.performance.retainedArtifactBytes = 1;
    record.metrics.v21ExactInterchange.performance.maxMainThreadLongTaskMs = 51;
    expect(auditV21Performance(record)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("corpus body count"),
        expect.stringContaining("main-thread long task"),
        expect.stringContaining("base64 calls"),
        expect.stringContaining("retained artifact bytes"),
        expect.stringContaining("OCCT WASM gzip bytes")
      ])
    );
  });
});
