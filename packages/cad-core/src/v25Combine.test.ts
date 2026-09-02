import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V20,
  CadEngine,
  exportCadProject,
  importCadProject
} from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

function seedOverlappingBlocks(engine: CadEngine): void {
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_block_a", name: "Block A", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_block_a",
      id: "rect_a",
      center: [0, 0],
      width: 20,
      height: 20
    },
    {
      op: "feature.extrude",
      id: "feat_block_a",
      bodyId: "body_block_a",
      sketchId: "sketch_block_a",
      entityId: "rect_a",
      depth: 10
    },
    { op: "sketch.create", id: "sketch_block_b", name: "Block B", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_block_b",
      id: "rect_b",
      center: [10, 0],
      width: 20,
      height: 20
    },
    {
      op: "feature.extrude",
      id: "feat_block_b",
      bodyId: "body_block_b",
      sketchId: "sketch_block_b",
      entityId: "rect_b",
      depth: 10
    }
  ]);
}

describe("feature.combine intersect", () => {
  it("intersects two overlapping completed solids into one result without a schema bump", () => {
    const engine = new CadEngine();
    seedOverlappingBlocks(engine);

    const result = engine.apply({
      op: "feature.combine",
      id: "feat_intersect",
      bodyId: "body_overlap",
      mode: "intersect",
      targetBodyId: "body_block_a",
      toolBodyId: "body_block_b"
    });

    expect(result.transaction.diff).toMatchObject({
      features: {
        created: [
          {
            id: "feat_intersect",
            kind: "combine",
            mode: "intersect",
            targetBodyId: "body_block_a",
            toolBodyId: "body_block_b",
            bodyId: "body_overlap"
          }
        ],
        bodiesCreated: [{ id: "body_overlap", kind: "solid" }]
      }
    });

    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(JSON.stringify(structure)).not.toMatch(PRIVATE_ID_PATTERN);
    expect(structure).toMatchObject({
      ok: true,
      query: "project.structure",
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_block_a",
          consumedByFeatureId: "feat_intersect"
        }),
        expect.objectContaining({
          id: "body_block_b",
          consumedByFeatureId: "feat_intersect"
        }),
        expect.objectContaining({
          id: "body_overlap",
          featureId: "feat_intersect",
          source: expect.objectContaining({
            type: "combineFeature",
            mode: "intersect",
            targetBodyId: "body_block_a",
            toolBodyId: "body_block_b"
          })
        })
      ])
    });

    const exported = exportCadProject(engine);
    expect(exported.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
    expect(exported.schemaVersion).not.toBe("web-cad.project.v23");
    expect(exported.schemaVersion).not.toBe("web-cad.project.v25");
    expect(
      exported.document.features.some(
        (feature) =>
          feature.kind === "combine" &&
          feature.id === "feat_intersect" &&
          feature.mode === "intersect"
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
          id: "feat_intersect",
          kind: "combine",
          mode: "intersect",
          targetBodyId: "body_block_a",
          toolBodyId: "body_block_b"
        })
      ]),
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_overlap",
          featureId: "feat_intersect"
        })
      ])
    });
  });

  it("still rejects unknown combine modes", () => {
    const engine = new CadEngine();
    seedOverlappingBlocks(engine);

    expect(() =>
      engine.apply({
        op: "feature.combine",
        mode: "common",
        targetBodyId: "body_block_a",
        toolBodyId: "body_block_b"
      } as never)
    ).toThrow(/union, subtract, or intersect/);
  });
});
