import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V20,
  CadEngine,
  exportCadProject,
  importCadProject
} from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

function seedBlockAndChamfer(engine: CadEngine): void {
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_block", name: "Block", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_block",
      id: "rect_block",
      center: [0, 0],
      width: 20,
      height: 12
    },
    {
      op: "feature.extrude",
      id: "feat_block",
      bodyId: "body_block",
      sketchId: "sketch_block",
      entityId: "rect_block",
      depth: 8
    },
    {
      op: "feature.chamfer",
      id: "feat_chamfer",
      bodyId: "body_chamfer",
      targetBodyId: "body_block",
      edgeStableId: "generated:edge:body_block:start:uMin",
      distance: 2
    }
  ]);
}

describe("feature pattern grown solid seed", () => {
  it("linear-patterns a completed chamfer, not a hole and not a whole body, without a schema bump", () => {
    const engine = new CadEngine();
    seedBlockAndChamfer(engine);

    const result = engine.apply({
      op: "feature.linearPattern",
      id: "feat_pattern",
      bodyId: "body_patterned",
      seedFeatureId: "feat_chamfer",
      direction: { kind: "globalAxis", axis: "x" },
      spacing: 30,
      instanceCount: 3
    });

    expect(result.transaction.diff).toMatchObject({
      features: {
        created: [
          {
            id: "feat_pattern",
            kind: "linearPattern",
            seedFeatureId: "feat_chamfer",
            bodyId: "body_patterned"
          }
        ],
        bodiesCreated: [{ id: "body_patterned", kind: "solid" }]
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
          id: "feat_chamfer",
          kind: "chamfer"
        }),
        expect.objectContaining({
          id: "feat_pattern",
          kind: "linearPattern",
          seedFeatureId: "feat_chamfer",
          bodyId: "body_patterned"
        })
      ]),
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_block",
          consumedByFeatureId: "feat_chamfer"
        }),
        expect.objectContaining({
          id: "body_chamfer",
          consumedByFeatureId: "feat_pattern"
        }),
        expect.objectContaining({
          id: "body_patterned",
          featureId: "feat_pattern",
          source: expect.objectContaining({
            type: "linearPatternFeature",
            seedFeatureId: "feat_chamfer"
          })
        })
      ])
    });
    expect(JSON.stringify(structure)).not.toMatch(PRIVATE_ID_PATTERN);

    const exported = exportCadProject(engine);
    expect(exported.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
    expect(exported.schemaVersion).not.toBe("web-cad.project.v23");
    expect(exported.schemaVersion).not.toBe("web-cad.project.v25");
    expect(
      exported.document.features.some(
        (feature) =>
          feature.kind === "linearPattern" &&
          feature.id === "feat_pattern" &&
          feature.seedFeatureId === "feat_chamfer" &&
          feature.seedBodyId === undefined
      )
    ).toBe(true);

    const restored = importCadProject(exported);
    const restoredStructure = restored.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(JSON.stringify(restoredStructure)).not.toMatch(PRIVATE_ID_PATTERN);
    expect(restoredStructure).toMatchObject({
      ok: true,
      features: expect.arrayContaining([
        expect.objectContaining({
          id: "feat_pattern",
          kind: "linearPattern",
          seedFeatureId: "feat_chamfer"
        })
      ])
    });
  });

  it("accepts a completed extrude seedFeatureId and still rejects exclusive-seed violations", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_boss", name: "Boss", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_boss",
        id: "rect_boss",
        center: [0, 0],
        width: 8,
        height: 8
      },
      {
        op: "feature.extrude",
        id: "feat_boss",
        bodyId: "body_boss",
        sketchId: "sketch_boss",
        entityId: "rect_boss",
        depth: 6
      }
    ]);

    const created = engine.apply({
      op: "feature.linearPattern",
      id: "feat_boss_pattern",
      bodyId: "body_boss_patterned",
      seedFeatureId: "feat_boss",
      direction: { kind: "globalAxis", axis: "y" },
      spacing: 24,
      instanceCount: 2
    });
    expect(created.transaction.diff).toMatchObject({
      features: {
        created: [
          expect.objectContaining({
            id: "feat_boss_pattern",
            kind: "linearPattern",
            seedFeatureId: "feat_boss"
          })
        ]
      }
    });

    expect(() =>
      engine.apply({
        op: "feature.linearPattern",
        seedBodyId: "body_boss",
        seedFeatureId: "feat_boss",
        direction: { kind: "globalAxis", axis: "x" },
        spacing: 30,
        instanceCount: 3
      } as never)
    ).toThrow(/seedBodyId or seedFeatureId/);
  });
});
