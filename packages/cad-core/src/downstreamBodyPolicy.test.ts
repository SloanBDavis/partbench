import type { CadBodySnapshot, CadBodySource } from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import {
  CAD_DOWNSTREAM_BODY_OPERATIONS,
  CAD_DOWNSTREAM_BODY_POLICY,
  createCadDownstreamBodyPolicyProjection,
  evaluateCadBodyDependencies
} from "./index";

describe("V21.1 downstream body policy", () => {
  it("combines the exhaustive source matrix with lifecycle, dependency, and shape policy", () => {
    const sourceTypes = [
      "primitiveFeature",
      "sketchExtrudeFeature",
      "sketchRevolveFeature",
      "sketchHoleFeature",
      "edgeChamferFeature",
      "edgeFilletFeature",
      "linearPatternFeature",
      "circularPatternFeature",
      "mirrorFeature",
      "shellFeature",
      "sweepFeature",
      "loftFeature",
      "importedStepBody"
    ] as const satisfies readonly CadBodySource["type"][];

    expect(Object.keys(CAD_DOWNSTREAM_BODY_POLICY)).toEqual(sourceTypes);
    for (const sourceType of sourceTypes) {
      expect(Object.keys(CAD_DOWNSTREAM_BODY_POLICY[sourceType])).toEqual(
        CAD_DOWNSTREAM_BODY_OPERATIONS
      );
      for (const operation of CAD_DOWNSTREAM_BODY_OPERATIONS) {
        const projection = createCadDownstreamBodyPolicyProjection({
          bodyId: `body_${sourceType}`,
          sourceType,
          operation,
          lifecycle: "active",
          dependencyStatus: "healthy",
          dependencyCycle: false,
          exactStatus: "ready",
          shapePolicy: "singleShapeOneOrMoreSolids"
        });
        expect(projection.sourceEligible).toBe(true);
        expect(projection.readiness.status).toBe(
          operation === "shellTarget" ? "unsupported" : "ready"
        );
      }
    }

    expect(
      createCadDownstreamBodyPolicyProjection({
        bodyId: "body_consumed",
        sourceType: "importedStepBody",
        operation: "holeTarget",
        lifecycle: "consumed",
        dependencyStatus: "healthy",
        dependencyCycle: false
      })
    ).toMatchObject({
      sourceEligible: false,
      readiness: {
        status: "blocked",
        diagnostics: [{ code: "EXPORT_BODY_CONSUMED" }]
      }
    });
    expect(
      createCadDownstreamBodyPolicyProjection({
        bodyId: "body_cycle",
        sourceType: "mirrorFeature",
        operation: "mirrorSeed",
        lifecycle: "active",
        dependencyStatus: "healthy",
        dependencyCycle: true
      }).readiness
    ).toMatchObject({
      status: "blocked",
      diagnostics: [{ received: "dependency cycle" }]
    });
    expect(
      createCadDownstreamBodyPolicyProjection({
        bodyId: "body_stale",
        sourceType: "shellFeature",
        operation: "shellTarget",
        lifecycle: "active",
        dependencyStatus: "stale",
        dependencyCycle: false
      }).readiness.status
    ).toBe("stale");
    expect(
      createCadDownstreamBodyPolicyProjection({
        bodyId: "body_single",
        sourceType: "sketchExtrudeFeature",
        operation: "shellTarget",
        lifecycle: "active",
        dependencyStatus: "healthy",
        dependencyCycle: false,
        exactStatus: "ready",
        shapePolicy: "singleSolid"
      }).readiness.status
    ).toBe("ready");

    const cyclicBodies: readonly CadBodySnapshot[] = [
      {
        id: "body_a",
        kind: "solid",
        partId: "part_1",
        featureId: "feature_a",
        source: {
          type: "sketchHoleFeature",
          featureId: "feature_a",
          targetBodyId: "body_b",
          sketchId: "sketch_a",
          circleEntityId: "circle_a"
        }
      },
      {
        id: "body_b",
        kind: "solid",
        partId: "part_1",
        featureId: "feature_b",
        source: {
          type: "mirrorFeature",
          featureId: "feature_b",
          seedBodyId: "body_a",
          plane: { kind: "standardPlane", plane: "XY" },
          includeOriginal: true
        }
      }
    ];
    const dependencyDocument = { features: new Map() };
    expect(
      evaluateCadBodyDependencies(dependencyDocument, cyclicBodies, "body_a")
    ).toEqual({ status: "missing-source", cycle: true });
    expect(
      evaluateCadBodyDependencies(
        dependencyDocument,
        cyclicBodies.slice(0, 1),
        "body_a"
      )
    ).toEqual({ status: "missing-source", cycle: false });

    const failedDiagnostics = [
      {
        code: "EXPORT_EXACT_ARTIFACT_FAILED" as const,
        status: "failed" as const,
        message: "first"
      },
      {
        code: "HOLE_RESULT_INVALID" as const,
        status: "failed" as const,
        message: "second"
      }
    ];
    expect(
      createCadDownstreamBodyPolicyProjection({
        bodyId: "body_failed",
        sourceType: "sketchHoleFeature",
        operation: "holeTarget",
        lifecycle: "active",
        dependencyStatus: "healthy",
        dependencyCycle: false,
        exactStatus: "failed",
        diagnostics: failedDiagnostics
      }).readiness.diagnostics
    ).toEqual(failedDiagnostics);
  });
});
