import type {
  CadBodySnapshot,
  CadBodySource,
  CadOp
} from "@web-cad/cad-protocol";
import { describe, expect, it } from "vitest";

import {
  CAD_DOWNSTREAM_BODY_OPERATIONS,
  CAD_DOWNSTREAM_BODY_POLICY,
  CAD_PATTERN_COMMAND_INSTANCE_LIMIT,
  CadEngine,
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
      "combineFeature",
      "offsetFeature",
      "alignFeature",
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

  it("routes primitive pattern, mirror, and shell create/update through the shared policy", () => {
    const scenarios: readonly {
      readonly create: CadOp;
      readonly update: CadOp;
    }[] = [
      {
        create: {
          op: "feature.linearPattern" as const,
          id: "feature_result",
          bodyId: "body_result",
          seedBodyId: "body:seed",
          direction: { kind: "globalAxis" as const, axis: "x" as const },
          spacing: 2,
          instanceCount: 2
        },
        update: {
          op: "feature.updateLinearPattern" as const,
          id: "feature_result",
          spacing: 3
        }
      },
      {
        create: {
          op: "feature.circularPattern" as const,
          id: "feature_result",
          bodyId: "body_result",
          seedBodyId: "body:seed",
          rotationAxis: {
            kind: "globalAxis" as const,
            axis: "z" as const
          },
          totalAngleDegrees: 360,
          instanceCount: 2
        },
        update: {
          op: "feature.updateCircularPattern" as const,
          id: "feature_result",
          totalAngleDegrees: 180
        }
      },
      {
        create: {
          op: "feature.mirror" as const,
          id: "feature_result",
          bodyId: "body_result",
          seedBodyId: "body:seed",
          mirrorPlane: "XY" as const,
          includeOriginal: true
        },
        update: {
          op: "feature.updateMirror" as const,
          id: "feature_result",
          mirrorPlane: "XZ" as const
        }
      },
      {
        create: {
          op: "feature.shell" as const,
          id: "feature_result",
          bodyId: "body_result",
          targetBodyId: "body:seed",
          wallThickness: 0.2,
          openFaceRefs: []
        },
        update: {
          op: "feature.updateShell" as const,
          id: "feature_result",
          wallThickness: 0.3
        }
      }
    ];

    for (const scenario of scenarios) {
      const engine = new CadEngine();
      engine.apply({
        op: "scene.createBox",
        id: "seed",
        dimensions: { width: 2, height: 2, depth: 2 }
      });

      expect(
        engine.executeBatch({
          version: "cadops.v1",
          mode: "commit",
          ops: [scenario.create]
        })
      ).toMatchObject({ ok: true, createdBodyIds: ["body_result"] });
      expect(
        engine.executeBatch({
          version: "cadops.v1",
          mode: "commit",
          ops: [scenario.update]
        })
      ).toMatchObject({ ok: true, modifiedBodyIds: ["body_result"] });
    }
  });

  it("keeps recursive pattern, mirror, and shell sources editable until their result is consumed", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      {
        op: "scene.createBox",
        id: "seed",
        dimensions: { width: 2, height: 2, depth: 2 }
      },
      {
        op: "feature.linearPattern",
        id: "linear",
        bodyId: "body_linear",
        seedBodyId: "body:seed",
        direction: { kind: "globalAxis", axis: "x" },
        spacing: 2,
        instanceCount: 2
      },
      {
        op: "feature.updateLinearPattern",
        id: "linear",
        spacing: 3
      },
      {
        op: "feature.circularPattern",
        id: "circular",
        bodyId: "body_circular",
        seedBodyId: "body_linear",
        rotationAxis: { kind: "globalAxis", axis: "z" },
        totalAngleDegrees: 360,
        instanceCount: 2
      },
      {
        op: "feature.updateCircularPattern",
        id: "circular",
        totalAngleDegrees: 180
      },
      {
        op: "feature.mirror",
        id: "mirror",
        bodyId: "body_mirror",
        seedBodyId: "body_circular",
        mirrorPlane: "XY",
        includeOriginal: false
      },
      {
        op: "feature.updateMirror",
        id: "mirror",
        mirrorPlane: "XZ"
      },
      {
        op: "feature.shell",
        id: "shell",
        bodyId: "body_shell",
        targetBodyId: "body_mirror",
        wallThickness: 0.2,
        openFaceRefs: []
      },
      {
        op: "feature.updateShell",
        id: "shell",
        wallThickness: 0.3
      }
    ]);

    expect(engine.getDocument().features.get("linear")).toMatchObject({
      spacing: 3
    });
    expect(engine.getDocument().features.get("circular")).toMatchObject({
      totalAngleDegrees: 180
    });
    expect(engine.getDocument().features.get("mirror")).toMatchObject({
      plane: { kind: "standardPlane", plane: "XZ" }
    });
    expect(engine.getDocument().features.get("shell")).toMatchObject({
      wallThickness: 0.3
    });
  });

  it("defers widened generated shell-face existence to exact preflight", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      {
        op: "scene.createBox",
        id: "seed",
        dimensions: { width: 2, height: 2, depth: 2 }
      },
      {
        op: "feature.mirror",
        id: "mirror",
        bodyId: "body_mirror",
        seedBodyId: "body:seed",
        mirrorPlane: "XY",
        includeOriginal: false
      }
    ]);

    expect(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            op: "feature.shell",
            id: "shell",
            bodyId: "body_shell",
            targetBodyId: "body_mirror",
            wallThickness: 0.2,
            openFaceRefs: [
              {
                kind: "generatedFace",
                bodyId: "body_mirror",
                stableId: "generated:face:current"
              }
            ]
          }
        ]
      })
    ).toMatchObject({ ok: true, createdBodyIds: ["body_shell"] });
  });

  it("classifies historical over-limit pattern dependencies as unsupported", () => {
    const bodies: readonly CadBodySnapshot[] = [
      {
        id: "body_pattern",
        kind: "solid",
        partId: "part_1",
        featureId: "feature_pattern",
        source: {
          type: "linearPatternFeature",
          featureId: "feature_pattern",
          seedBodyId: "body_seed",
          direction: { kind: "globalAxis", axis: "x" },
          spacing: 1,
          instanceCount: CAD_PATTERN_COMMAND_INSTANCE_LIMIT + 1,
          instances: []
        }
      },
      {
        id: "body_seed",
        kind: "solid",
        partId: "part_1",
        featureId: "feature_seed",
        source: {
          type: "sketchExtrudeFeature",
          featureId: "feature_seed",
          sketchId: "sketch_seed",
          entityId: "rect_seed",
          profileKind: "rectangle"
        }
      }
    ];
    const document = {
      features: new Map([
        [
          "feature_pattern",
          {
            id: "feature_pattern",
            kind: "linearPattern" as const,
            seedBodyId: "body_seed",
            direction: { kind: "globalAxis" as const, axis: "x" as const },
            spacing: 1,
            instanceCount: CAD_PATTERN_COMMAND_INSTANCE_LIMIT + 1,
            instances: [],
            bodyId: "body_pattern"
          }
        ]
      ])
    };

    expect(
      evaluateCadBodyDependencies(document, bodies, "body_pattern")
    ).toEqual({ status: "unsupported", cycle: false });
  });
});
