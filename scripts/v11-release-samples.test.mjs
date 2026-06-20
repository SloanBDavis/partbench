import { describe, expect, it } from "vitest";
import * as cadCore from "../packages/cad-core/src/index.ts";
import {
  formatV11ReleaseSampleSmokeSummary,
  runV11ReleaseSampleSmoke,
  V11_RELEASE_BOUNDARY_LEAK_PATTERN
} from "./v11-release-samples.mjs";

describe("V11 release sketch solver smoke runner", () => {
  it("verifies deterministic sketch solve, dry-run, rebuild, and round-trip chains", async () => {
    const result = await runV11ReleaseSampleSmoke(cadCore);

    expect(result).toMatchObject({
      ok: true,
      sampleCount: 2,
      passedCount: 2,
      failedCount: 0
    });
    expect(result.solverCheckCount).toBeGreaterThanOrEqual(30);
    expect(result.dryRunCheckCount).toBeGreaterThanOrEqual(5);
    expect(result.rebuildCheckCount).toBeGreaterThanOrEqual(6);
    expect(result.roundTripCheckCount).toBeGreaterThanOrEqual(18);
    expect(result.samples.map((sample) => sample.id)).toEqual([
      "v11-command-sketch-feature-chain",
      "v11-advanced-constraint-source-chain"
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      V11_RELEASE_BOUNDARY_LEAK_PATTERN
    );
    expect(formatV11ReleaseSampleSmokeSummary(result)).toBe(
      [
        "V11 release sketch solver smoke passed",
        "samples: 2 passed, 0 failed, 2 total",
        `checks: ${result.solverCheckCount} solver, ${result.dryRunCheckCount} dry-run, ${result.rebuildCheckCount} rebuild/reference, ${result.roundTripCheckCount} round-trip`,
        "- pass v11-command-sketch-feature-chain | solver 16 | dry-run 4 | rebuild 6 | round-trips 9",
        "- pass v11-advanced-constraint-source-chain | solver 22 | dry-run 1 | rebuild 0 | round-trips 9"
      ].join("\n")
    );
  });
});
