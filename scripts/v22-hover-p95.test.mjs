import { describe, expect, it } from "vitest";
import {
  auditV22HoverP95,
  createV22HoverP95Report,
  V22_HOVER_P95_GATE_MS,
  V22_HOVER_P95_REPORT_VERSION
} from "./v22-hover-p95.mjs";

function baseReport() {
  return {
    version: V22_HOVER_P95_REPORT_VERSION,
    ok: true,
    status: "passed",
    metrics: {
      hover: { count: 3, p50: 0.5, p95: 1.0, max: 1.2, min: 0.1 },
      candidateCounts: {},
      uiApply: { count: 2000, p50: 0.01, p95: 0.02, max: 0.03, min: 0.01 },
      fixture: {
        bodyCount: 4,
        totalTriangleCount: 65_536,
        examinedTriangleCount: 40_000
      },
      retainedCandidateBytes: 1_024,
      restart: { totalMs: 12, hoverP95Ms: 0.8 }
    },
    failures: []
  };
}

describe("v22 hover p95 audit", () => {
  it("passes when hover p95 and ui apply stay within gate", () => {
    const failures = auditV22HoverP95(baseReport());
    expect(failures).toEqual([]);
  });

  it("fails when hover p95 exceeds the gate", () => {
    const report = baseReport();
    report.metrics.hover.p95 = V22_HOVER_P95_GATE_MS + 1;
    const failures = auditV22HoverP95(report);
    expect(failures.some((f) => f.startsWith("hover p95 gate"))).toBe(true);
  });

  it("flags a missed hover gate without proposing an index", () => {
    const report = baseReport();
    report.metrics.hover.p95 = 40;
    const result = createV22HoverP95Report({
      status: "ok",
      scenario: "v22-hover-p95",
      metrics: report.metrics
    });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.startsWith("hover p95 gate"))).toBe(
      true
    );
    expect(
      JSON.stringify(result).includes("acceleration") ||
        JSON.stringify(result).includes("index")
    ).toBe(false);
  });

  it("flags holes in the required evidence", () => {
    const report = baseReport();
    report.metrics.uiApply = undefined;
    expect(auditV22HoverP95(report).some((f) => f.includes("ui apply"))).toBe(
      true
    );
  });

  it("flags incomplete fixture or restart evidence", () => {
    const report = baseReport();
    fallthroughFixture(report);
    expect(auditV22HoverP95(report).some((f) => f.includes("fixture"))).toBe(
      true
    );
    report.metrics.fixture = {
      bodyCount: 4,
      totalTriangleCount: 10,
      examinedTriangleCount: 5
    };
    report.metrics.restart = undefined;
    expect(auditV22HoverP95(report).some((f) => f.includes("restart"))).toBe(
      true
    );
  });
});

function fallthroughFixture(report) {
  report.metrics.fixture = {
    bodyCount: 0,
    totalTriangleCount: 0,
    examinedTriangleCount: 0
  };
}
