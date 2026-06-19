import { describe, expect, it } from "vitest";
import * as cadCore from "../packages/cad-core/src/index.ts";
import {
  formatV10ReleaseSampleSmokeSummary,
  runV10ReleaseSampleSmoke,
  V10_RELEASE_BOUNDARY_LEAK_PATTERN
} from "./v10-release-samples.mjs";

describe("V10 release edit/rebuild smoke runner", () => {
  it("verifies deterministic V10 edit, rebuild, repair, and round-trip chains", async () => {
    const result = await runV10ReleaseSampleSmoke(cadCore);

    expect(result).toMatchObject({
      ok: true,
      sampleCount: 3,
      passedCount: 3,
      failedCount: 0
    });
    expect(result.editCheckCount).toBeGreaterThanOrEqual(30);
    expect(result.rebuildCheckCount).toBeGreaterThanOrEqual(15);
    expect(result.referenceHealthCheckCount).toBeGreaterThanOrEqual(72);
    expect(result.repairCheckCount).toBeGreaterThanOrEqual(7);
    expect(result.roundTripCheckCount).toBeGreaterThanOrEqual(60);
    expect(result.samples.map((sample) => sample.id)).toEqual([
      "v10-extrude-edit-attached-sketch",
      "v10-c2-feature-lifecycle-edits",
      "v10-named-reference-repair-roundtrip"
    ]);
    expect(result.samples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "v10-extrude-edit-attached-sketch",
          status: "pass",
          rebuild: expect.objectContaining({
            status: "pending",
            lifecycleStates: expect.arrayContaining([
              "active",
              "derived-rebuild-pending"
            ])
          })
        }),
        expect.objectContaining({
          id: "v10-c2-feature-lifecycle-edits",
          status: "pass",
          rebuild: expect.objectContaining({
            status: "repair-needed",
            lifecycleStates: expect.arrayContaining([
              "consumed",
              "derived-rebuild-pending",
              "repair-needed"
            ])
          })
        }),
        expect.objectContaining({
          id: "v10-named-reference-repair-roundtrip",
          status: "pass",
          repairCheckCount: 7,
          rebuild: expect.objectContaining({
            status: "pending",
            lifecycleStates: expect.arrayContaining(["derived-rebuild-pending"])
          })
        })
      ])
    );
    expect(JSON.stringify(result)).not.toMatch(
      V10_RELEASE_BOUNDARY_LEAK_PATTERN
    );
    expect(JSON.stringify(result)).not.toContain("web-cad.project.v17");
    expect(formatV10ReleaseSampleSmokeSummary(result)).toBe(
      [
        "V10 release edit/rebuild smoke passed",
        "samples: 3 passed, 0 failed, 3 total",
        `checks: ${result.editCheckCount} edit, ${result.rebuildCheckCount} rebuild, ${result.referenceHealthCheckCount} reference-health, ${result.repairCheckCount} repair, ${result.roundTripCheckCount} round-trip`,
        "- pass v10-extrude-edit-attached-sketch | edits 14 | rebuild pending/2 bodies | health 18 | repairs 0 | round-trips 20",
        "- pass v10-c2-feature-lifecycle-edits | edits 30 | rebuild repair-needed/7 bodies | health 36 | repairs 0 | round-trips 20",
        "- pass v10-named-reference-repair-roundtrip | edits 9 | rebuild pending/1 bodies | health 18 | repairs 7 | round-trips 20"
      ].join("\n")
    );
  });

  it("reports fixture expectation failures in the V10 result", async () => {
    const [fixture] = cadCore.listV10ReleaseSampleFixtures();
    const result = await runV10ReleaseSampleSmoke(cadCore, {
      fixtures: [
        {
          ...fixture,
          expectedRebuild: {
            ...fixture.expectedRebuild,
            committedStatus: "failed"
          }
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
        'attached.rebuild.status: expected "failed", got "pending"'
      ])
    );
    expect(formatV10ReleaseSampleSmokeSummary(result)).toContain(
      "V10 release edit/rebuild smoke failed"
    );
  });
});
