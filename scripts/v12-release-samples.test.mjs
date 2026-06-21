import { describe, expect, it } from "vitest";
import * as cadCore from "../packages/cad-core/src/index.ts";
import {
  formatV12ReleaseSampleSmokeSummary,
  runV12ReleaseSampleSmoke,
  V12_RELEASE_BOUNDARY_LEAK_PATTERN
} from "./v12-release-samples.mjs";

describe("V12 release boolean topology smoke runner", () => {
  it("verifies deterministic cut/add-result reference and round-trip chains", async () => {
    const result = await runV12ReleaseSampleSmoke(cadCore);

    expect(result).toMatchObject({
      ok: true,
      sampleCount: 3,
      passedCount: 3,
      failedCount: 0
    });
    expect(result.topologyCheckCount).toBeGreaterThanOrEqual(12);
    expect(result.referenceCheckCount).toBeGreaterThanOrEqual(28);
    expect(result.measurementCheckCount).toBeGreaterThanOrEqual(12);
    expect(result.roundTripCheckCount).toBeGreaterThanOrEqual(18);
    expect(result.samples.map((sample) => sample.id)).toEqual([
      "v12-rectangle-cut-reference-chain",
      "v12-rectangle-add-reference-chain",
      "v12-circle-tool-boolean-reference-chain"
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      V12_RELEASE_BOUNDARY_LEAK_PATTERN
    );
    expect(formatV12ReleaseSampleSmokeSummary(result)).toBe(
      [
        "V12 release boolean topology smoke passed",
        "samples: 3 passed, 0 failed, 3 total",
        `checks: ${result.topologyCheckCount} topology, ${result.referenceCheckCount} reference, ${result.measurementCheckCount} measurement, ${result.roundTripCheckCount} round-trip`,
        "- pass v12-rectangle-cut-reference-chain | topology 6 | reference 64 | measurement 6 | round-trips 9",
        "- pass v12-rectangle-add-reference-chain | topology 6 | reference 78 | measurement 9 | round-trips 9",
        "- pass v12-circle-tool-boolean-reference-chain | topology 8 | reference 31 | measurement 9 | round-trips 9"
      ].join("\n")
    );
  });
});
