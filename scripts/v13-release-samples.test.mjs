import { describe, expect, it } from "vitest";
import * as cadCore from "../packages/cad-core/src/index.ts";
import {
  formatV13ReleaseSampleSmokeSummary,
  runV13ReleaseSampleSmoke,
  V13_RELEASE_BOUNDARY_LEAK_PATTERN
} from "./v13-release-samples.mjs";

describe("V13 topology identity smoke runner", () => {
  it("verifies deterministic topology checkpoint, repair, command, match, and package chains", async () => {
    const result = await runV13ReleaseSampleSmoke(cadCore);

    expect(result).toMatchObject({
      ok: true,
      sampleCount: 1,
      passedCount: 1,
      failedCount: 0,
      topologyCheckCount: 4,
      referenceCheckCount: 5,
      commandCheckCount: 2,
      matchCheckCount: 9,
      roundTripCheckCount: 17
    });
    expect(result.samples.map((sample) => sample.id)).toEqual([
      "v13-topology-anchor-repair-command-chain"
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      V13_RELEASE_BOUNDARY_LEAK_PATTERN
    );
    expect(formatV13ReleaseSampleSmokeSummary(result)).toBe(
      [
        "V13 topology identity smoke passed",
        "samples: 1 passed, 0 failed, 1 total",
        "checks: 4 topology, 5 reference, 2 command, 9 match, 17 round-trip",
        "- pass v13-topology-anchor-repair-command-chain | topology 4 | reference 5 | command 2 | match 9 | round-trips 17"
      ].join("\n")
    );
  });

  it("reports fixture expectation failures in the V13 result", async () => {
    const [fixture] = cadCore.listV13ReleaseSampleFixtures();
    const result = await runV13ReleaseSampleSmoke(cadCore, {
      fixtures: [
        {
          ...fixture,
          expectedTopology: {
            ...fixture.expectedTopology,
            anchorCount: fixture.expectedTopology.anchorCount + 99
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
      expect.arrayContaining(["topology.anchorCount: expected 101, got 2"])
    );
    expect(formatV13ReleaseSampleSmokeSummary(result)).toContain(
      "V13 topology identity smoke failed"
    );
  });

  it("fails empty fixture sets and guards private identifier checks precisely", async () => {
    const result = await runV13ReleaseSampleSmoke(cadCore, { fixtures: [] });

    expect(result).toMatchObject({
      ok: false,
      sampleCount: 0,
      passedCount: 0,
      failedCount: 0,
      invariantFailures: expect.arrayContaining([
        "V13 release smoke requires at least one fixture.",
        "V13 release smoke requires topology checks.",
        "V13 release smoke requires reference checks.",
        "V13 release smoke requires command checks.",
        "V13 release smoke requires match checks.",
        "V13 release smoke requires round-trip checks."
      ])
    });
    expect(formatV13ReleaseSampleSmokeSummary(result)).toContain(
      "- invariant-fail V13 release smoke requires at least one fixture."
    );

    for (const leaked of [
      "checkpointEntityId",
      "checkpoint-local-face-1",
      "gpuId",
      "gpuBuffer",
      "exportArtifactId"
    ]) {
      expect(leaked).toMatch(V13_RELEASE_BOUNDARY_LEAK_PATTERN);
    }

    for (const publicText of [
      "mytopologyIndexLabel",
      "previousCheckpointEntityId"
    ]) {
      expect(publicText).not.toMatch(V13_RELEASE_BOUNDARY_LEAK_PATTERN);
    }
  });
});
