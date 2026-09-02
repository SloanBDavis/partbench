import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V20,
  CadEngine,
  exportCadProject,
  importCadProject
} from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

function seedPlateAndBoss(engine: CadEngine): void {
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_plate", name: "Plate", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_plate",
      id: "rect_plate",
      center: [0, 0],
      width: 60,
      height: 24
    },
    {
      op: "feature.extrude",
      id: "feat_plate",
      bodyId: "body_plate",
      sketchId: "sketch_plate",
      entityId: "rect_plate",
      depth: 6
    },
    { op: "sketch.create", id: "sketch_boss", name: "Boss", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_boss",
      id: "rect_boss",
      center: [-16, 0],
      width: 8,
      height: 8
    },
    {
      op: "feature.extrude",
      id: "feat_boss",
      bodyId: "body_boss",
      sketchId: "sketch_boss",
      entityId: "rect_boss",
      depth: 10,
      operationMode: "add",
      targetBodyId: "body_plate"
    }
  ]);
}

describe("feature pattern grown solid seed", () => {
  it("linear-patterns a completed extrude-add on the parent, not a hole and not a whole-body copy, without a schema bump", () => {
    const engine = new CadEngine();
    seedPlateAndBoss(engine);

    const result = engine.apply({
      op: "feature.linearPattern",
      id: "feat_pattern",
      bodyId: "body_patterned",
      seedFeatureId: "feat_boss",
      direction: { kind: "globalAxis", axis: "x" },
      spacing: 16,
      instanceCount: 3
    });

    expect(result.transaction.diff).toMatchObject({
      features: {
        created: [
          {
            id: "feat_pattern",
            kind: "linearPattern",
            seedFeatureId: "feat_boss",
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
          id: "feat_boss",
          kind: "extrude",
          operationMode: "add",
          targetBodyId: "body_plate"
        }),
        expect.objectContaining({
          id: "feat_pattern",
          kind: "linearPattern",
          seedFeatureId: "feat_boss",
          bodyId: "body_patterned"
        })
      ]),
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_plate",
          consumedByFeatureId: "feat_boss"
        }),
        expect.objectContaining({
          id: "body_boss",
          consumedByFeatureId: "feat_pattern"
        }),
        expect.objectContaining({
          id: "body_patterned",
          featureId: "feat_pattern",
          source: expect.objectContaining({
            type: "linearPatternFeature",
            seedFeatureId: "feat_boss"
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
          feature.seedFeatureId === "feat_boss" &&
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
          seedFeatureId: "feat_boss"
        }),
        expect.objectContaining({
          id: "feat_boss",
          kind: "extrude",
          operationMode: "add"
        })
      ])
    });
  });

  it("still rejects exclusive-seed violations on an extrude-add pattern", () => {
    const engine = new CadEngine();
    seedPlateAndBoss(engine);

    expect(() =>
      engine.apply({
        op: "feature.linearPattern",
        seedBodyId: "body_boss",
        seedFeatureId: "feat_boss",
        direction: { kind: "globalAxis", axis: "x" },
        spacing: 16,
        instanceCount: 3
      } as never)
    ).toThrow(/seedBodyId or seedFeatureId/);
  });
});
