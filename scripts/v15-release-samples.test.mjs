import { describe, expect, it } from "vitest";
import * as cadCore from "../packages/cad-core/src/index.ts";
import {
  formatV15ReleaseSampleSmokeSummary,
  runV15ReleaseSampleSmoke,
  V15_RELEASE_BOUNDARY_LEAK_PATTERN
} from "./v15-release-samples.mjs";

describe("V15 release hardening smoke runner", () => {
  it("verifies deterministic V15 command, query, round-trip, and boundary chains", async () => {
    const result = await runV15ReleaseSampleSmoke(cadCore);

    expect(result).toMatchObject({
      ok: true,
      sampleCount: 5,
      passedCount: 5,
      failedCount: 0
    });
    expect(result.operationCheckCount).toBeGreaterThan(0);
    expect(result.structureCheckCount).toBeGreaterThan(0);
    expect(result.healthCheckCount).toBeGreaterThan(0);
    expect(result.expressionCheckCount).toBeGreaterThan(0);
    expect(result.roundTripCheckCount).toBeGreaterThan(0);
    expect(result.boundaryCheckCount).toBeGreaterThan(0);
    expect(result.samples.map((sample) => sample.id)).toEqual([
      "v15-linear-pattern",
      "v15-circular-pattern",
      "v15-mirror",
      "v15-shell",
      "v15-expression-chain"
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      V15_RELEASE_BOUNDARY_LEAK_PATTERN
    );
    expect(formatV15ReleaseSampleSmokeSummary(result)).toContain(
      "V15 release hardening smoke passed"
    );
  });

  it("reports fixture expectation failures", async () => {
    const [fixture] = cadCore.listV15ReleaseSampleFixtures();
    const result = await runV15ReleaseSampleSmoke(cadCore, {
      fixtures: [
        {
          ...fixture,
          expectedFeatures: [
            {
              ...fixture.expectedFeatures[0],
              bodyId: "wrong_body"
            }
          ]
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
        "v15_linear_seed_feature.bodyId: expected wrong_body, got v15_linear_seed_body"
      ])
    );
    expect(formatV15ReleaseSampleSmokeSummary(result)).toContain(
      "V15 release hardening smoke failed"
    );
  });

  it("fails empty fixture sets and guards private identifier checks", async () => {
    const result = await runV15ReleaseSampleSmoke(cadCore, { fixtures: [] });

    expect(result).toMatchObject({
      ok: false,
      sampleCount: 0,
      passedCount: 0,
      failedCount: 0,
      invariantFailures: expect.arrayContaining([
        "V15 release smoke requires at least one fixture.",
        "V15 release smoke requires operation checks.",
        "V15 release smoke requires structure checks.",
        "V15 release smoke requires health checks.",
        "V15 release smoke requires round-trip checks.",
        "V15 release smoke requires boundary checks."
      ])
    });
    expect(formatV15ReleaseSampleSmokeSummary(result)).toContain(
      "- invariant-fail V15 release smoke requires at least one fixture."
    );

    for (const leaked of [
      "checkpoint-local-face-1",
      "rendererId",
      "gpuBuffer",
      "exportArtifactId"
    ]) {
      expect(leaked).toMatch(V15_RELEASE_BOUNDARY_LEAK_PATTERN);
    }

    for (const publicText of ["linearPattern", "project.parameterEvaluation"]) {
      expect(publicText).not.toMatch(V15_RELEASE_BOUNDARY_LEAK_PATTERN);
    }
  });
});
