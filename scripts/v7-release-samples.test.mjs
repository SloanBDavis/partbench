import { describe, expect, it } from "vitest";
import * as cadCore from "../packages/cad-core/src/index.ts";
import {
  formatV7ReleaseSampleSmokeSummary,
  RAW_DERIVED_ID_PATTERN,
  runV7ReleaseSampleSmoke
} from "./v7-release-samples.mjs";

describe("V7 release sample smoke runner", () => {
  it("returns a deterministic success summary for all release samples", () => {
    const result = runV7ReleaseSampleSmoke(cadCore);

    expect(result).toMatchObject({
      ok: true,
      sampleCount: 6,
      passedCount: 6,
      failedCount: 0
    });
    expect(result.samples.map((sample) => sample.id)).toEqual([
      "v7-rectangle-extrude-reference",
      "v7-circle-extrude-export",
      "v7-consumed-body-diagnostics",
      "v7-revolve-source-diagnostics",
      "v7-hole-source-diagnostics",
      "v7-edge-finish-source-diagnostics"
    ]);
    expect(result.samples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "v7-rectangle-extrude-reference",
          status: "pass",
          health: { status: "under-defined", issueCount: 1 },
          selection: {
            candidateCount: 4,
            commandableCount: 4,
            queryCount: 4
          },
          exportFormats: [
            { available: false, format: "step", status: "deferred" },
            { available: false, format: "glb", status: "deferred" }
          ]
        })
      ])
    );
    expect(JSON.stringify(result)).not.toMatch(RAW_DERIVED_ID_PATTERN);

    expect(formatV7ReleaseSampleSmokeSummary(result)).toBe(
      [
        "V7 release sample smoke passed",
        "samples: 6 passed, 0 failed, 6 total",
        "- pass v7-rectangle-extrude-reference | V7 rectangle extrude reference sample | health under-defined/1 | 4 selections, 4 candidates, 4 commandable | exports step:deferred:unavailable, glb:deferred:unavailable",
        "- pass v7-circle-extrude-export | V7 circle extrude export-readiness sample | health under-defined/1 | 5 selections, 5 candidates, 4 commandable | exports step:deferred:unavailable, glb:deferred:unavailable",
        "- pass v7-consumed-body-diagnostics | V7 consumed body diagnostics sample | health under-defined/1 | 4 selections, 3 candidates, 0 commandable | exports step:deferred:unavailable, glb:deferred:unavailable",
        "- pass v7-revolve-source-diagnostics | V7 revolve source diagnostics sample | health under-defined/1 | 2 selections, 0 candidates, 0 commandable | exports step:deferred:unavailable, glb:deferred:unavailable",
        "- pass v7-hole-source-diagnostics | V7 hole source diagnostics sample | health under-defined/2 | 3 selections, 2 candidates, 0 commandable | exports step:deferred:unavailable, glb:deferred:unavailable",
        "- pass v7-edge-finish-source-diagnostics | V7 edge-finish source diagnostics sample | health under-defined/2 | 5 selections, 3 candidates, 0 commandable | exports step:deferred:unavailable, glb:deferred:unavailable"
      ].join("\n")
    );
  });

  it("reports synthetic fixture expectation failures without mutating fixtures", () => {
    const [fixture] = cadCore.listV7ReleaseSampleFixtures();
    const result = runV7ReleaseSampleSmoke(cadCore, {
      fixtures: [
        {
          ...fixture,
          expectedHealthIssueCount: fixture.expectedHealthIssueCount + 99
        }
      ]
    });

    expect(result).toMatchObject({
      ok: false,
      sampleCount: 1,
      passedCount: 0,
      failedCount: 1
    });
    expect(result.samples[0].failures).toEqual(
      expect.arrayContaining([
        "project.health.issueCount: expected 100, got 1",
        "project.summary.health.issueCount: expected 100, got 1"
      ])
    );
    expect(formatV7ReleaseSampleSmokeSummary(result)).toContain(
      "V7 release sample smoke failed"
    );
  });
});
