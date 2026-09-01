import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V20,
  CadEngine,
  exportCadProject,
  importCadProject
} from "./index";

function seedFlangeDiscAndHoles(engine: CadEngine): void {
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_disc", name: "Disc", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_disc",
      id: "circle_disc",
      center: [0, 0],
      radius: 40
    },
    {
      op: "feature.extrude",
      id: "feat_disc",
      bodyId: "body_disc",
      sketchId: "sketch_disc",
      entityId: "circle_disc",
      depth: 8
    },
    { op: "sketch.create", id: "sketch_bore", name: "Bore", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_bore",
      id: "circle_bore",
      center: [0, 0],
      radius: 8
    },
    {
      op: "feature.hole",
      id: "feat_bore",
      bodyId: "body_bored",
      targetBodyId: "body_disc",
      sketchId: "sketch_bore",
      circleEntityId: "circle_bore",
      depthMode: "throughAll"
    },
    { op: "sketch.create", id: "sketch_bolt", name: "Bolt", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_bolt",
      id: "circle_bolt",
      center: [28, 0],
      radius: 3
    },
    {
      op: "feature.hole",
      id: "feat_bolt",
      bodyId: "body_bolt",
      targetBodyId: "body_bored",
      sketchId: "sketch_bolt",
      circleEntityId: "circle_bolt",
      depthMode: "throughAll"
    }
  ]);
}

describe("feature pattern hole seed", () => {
  it("circular-patterns a completed feature.hole, not a body copy", () => {
    const engine = new CadEngine();
    seedFlangeDiscAndHoles(engine);

    const result = engine.apply({
      op: "feature.circularPattern",
      id: "feat_bolts",
      bodyId: "body_flange",
      seedFeatureId: "feat_bolt",
      rotationAxis: { kind: "globalAxis", axis: "z" },
      totalAngleDegrees: 360,
      instanceCount: 6
    });

    expect(result.transaction.diff).toMatchObject({
      features: {
        created: [
          {
            id: "feat_bolts",
            kind: "circularPattern",
            seedFeatureId: "feat_bolt",
            bodyId: "body_flange"
          }
        ],
        bodiesCreated: [{ id: "body_flange", kind: "solid" }]
      }
    });
    expect(result.transaction.diff.features?.created?.[0]).not.toHaveProperty(
      "seedBodyId"
    );

    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(structure).toMatchObject({
      ok: true,
      query: "project.structure",
      features: expect.arrayContaining([
        expect.objectContaining({
          id: "feat_bolts",
          kind: "circularPattern",
          seedFeatureId: "feat_bolt",
          bodyId: "body_flange"
        })
      ]),
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_disc",
          consumedByFeatureId: "feat_bore"
        }),
        expect.objectContaining({
          id: "body_bored",
          consumedByFeatureId: "feat_bolt"
        }),
        expect.objectContaining({
          id: "body_bolt",
          consumedByFeatureId: "feat_bolts"
        }),
        expect.objectContaining({
          id: "body_flange",
          featureId: "feat_bolts",
          source: expect.objectContaining({
            type: "circularPatternFeature",
            seedFeatureId: "feat_bolt"
          })
        })
      ])
    });
    expect(JSON.stringify(structure)).not.toMatch(
      /snapshot-local|raw-occt|entitySignature|localId/i
    );
  });

  it("rejects missing, combined, or nested pattern-of-pattern seeds", () => {
    const engine = new CadEngine();
    seedFlangeDiscAndHoles(engine);
    engine.apply({
      op: "feature.circularPattern",
      id: "feat_bolts",
      bodyId: "body_flange",
      seedFeatureId: "feat_bolt",
      rotationAxis: { kind: "globalAxis", axis: "z" },
      totalAngleDegrees: 360,
      instanceCount: 6
    });

    expect(() =>
      engine.apply({
        op: "feature.circularPattern",
        rotationAxis: { kind: "globalAxis", axis: "z" },
        totalAngleDegrees: 360,
        instanceCount: 6
      } as never)
    ).toThrow(/seedBodyId or seedFeatureId/);

    expect(() =>
      engine.apply({
        op: "feature.circularPattern",
        seedBodyId: "body_bolt",
        seedFeatureId: "feat_bolt",
        rotationAxis: { kind: "globalAxis", axis: "z" },
        totalAngleDegrees: 360,
        instanceCount: 6
      } as never)
    ).toThrow(/seedBodyId or seedFeatureId/);

    expect(() =>
      engine.apply({
        op: "feature.linearPattern",
        seedFeatureId: "feat_bolts",
        direction: { kind: "globalAxis", axis: "x" },
        spacing: 20,
        instanceCount: 2
      })
    ).toThrow(/nested pattern-of-pattern/);
  });

  it("round-trips a hole-seeded pattern on existing project schema without a bump", () => {
    const engine = new CadEngine();
    seedFlangeDiscAndHoles(engine);
    engine.apply({
      op: "feature.circularPattern",
      id: "feat_bolts",
      bodyId: "body_flange",
      seedFeatureId: "feat_bolt",
      rotationAxis: { kind: "globalAxis", axis: "z" },
      totalAngleDegrees: 360,
      instanceCount: 6
    });

    const exported = exportCadProject(engine);
    expect(exported.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
    expect(exported.schemaVersion).not.toBe("web-cad.project.v23");
    expect(exported.schemaVersion).not.toBe("web-cad.project.v24");
    expect(
      exported.document.features.some(
        (feature) =>
          feature.kind === "circularPattern" &&
          feature.id === "feat_bolts" &&
          feature.seedFeatureId === "feat_bolt" &&
          feature.seedBodyId === undefined
      )
    ).toBe(true);

    const restored = importCadProject(exported);
    const structure = restored.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(structure).toMatchObject({
      ok: true,
      features: expect.arrayContaining([
        expect.objectContaining({
          id: "feat_bolts",
          kind: "circularPattern",
          seedFeatureId: "feat_bolt"
        })
      ]),
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_flange",
          featureId: "feat_bolts"
        })
      ])
    });
  });
});
