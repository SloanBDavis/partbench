import { describe, expect, it } from "vitest";
import * as cadCore from "../packages/cad-core/src/index.ts";
import {
  formatV14ReleaseSampleSmokeSummary,
  runV14ReleaseSampleSmoke,
  V14_RELEASE_BOUNDARY_LEAK_PATTERN
} from "./v14-release-samples.mjs";

describe("V14 topology-backed modeling smoke runner", () => {
  it("verifies deterministic command, readiness, lifecycle, package, and boundary chains", async () => {
    const result = await runV14ReleaseSampleSmoke(cadCore);

    expect(result).toMatchObject({
      ok: true,
      sampleCount: 3,
      passedCount: 3,
      failedCount: 0
    });
    expect(result.operationCheckCount).toBeGreaterThan(0);
    expect(result.readinessCheckCount).toBeGreaterThan(0);
    expect(result.lifecycleCheckCount).toBeGreaterThan(0);
    expect(result.roundTripCheckCount).toBeGreaterThan(0);
    expect(result.boundaryCheckCount).toBeGreaterThan(0);
    expect(result.samples.map((sample) => sample.id)).toEqual([
      "v14-result-body-cut-add-hole",
      "v14-circle-side-plane-hole",
      "v14-result-edge-finish"
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      V14_RELEASE_BOUNDARY_LEAK_PATTERN
    );
    expect(formatV14ReleaseSampleSmokeSummary(result)).toContain(
      "V14 topology-backed modeling smoke passed"
    );
  });

  it("reports fixture expectation failures in the V14 result", async () => {
    const [fixture] = cadCore.listV14ReleaseSampleFixtures();
    const result = await runV14ReleaseSampleSmoke(cadCore, {
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
      expect.arrayContaining(["topology.anchorCount: expected 102, got 3"])
    );
    expect(formatV14ReleaseSampleSmokeSummary(result)).toContain(
      "V14 topology-backed modeling smoke failed"
    );
  });

  it("fails empty fixture sets and guards private identifier checks precisely", async () => {
    const result = await runV14ReleaseSampleSmoke(cadCore, { fixtures: [] });

    expect(result).toMatchObject({
      ok: false,
      sampleCount: 0,
      passedCount: 0,
      failedCount: 0,
      invariantFailures: expect.arrayContaining([
        "V14 release smoke requires at least one fixture.",
        "V14 release smoke requires operation checks.",
        "V14 release smoke requires readiness checks.",
        "V14 release smoke requires lifecycle checks.",
        "V14 release smoke requires round-trip checks.",
        "V14 release smoke requires boundary checks."
      ])
    });
    expect(formatV14ReleaseSampleSmokeSummary(result)).toContain(
      "- invariant-fail V14 release smoke requires at least one fixture."
    );

    for (const leaked of [
      "checkpointEntityId",
      "checkpoint-local-face-1",
      "gpuId",
      "gpuBuffer",
      "exportArtifactId"
    ]) {
      expect(leaked).toMatch(V14_RELEASE_BOUNDARY_LEAK_PATTERN);
    }

    for (const publicText of [
      "mytopologyIndexLabel",
      "previousCheckpointEntityId"
    ]) {
      expect(publicText).not.toMatch(V14_RELEASE_BOUNDARY_LEAK_PATTERN);
    }
  });
});
