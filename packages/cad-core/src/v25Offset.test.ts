import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V20,
  CadEngine,
  exportCadProject,
  importCadProject
} from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

function seedPlateAndBlock(engine: CadEngine): void {
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_plate", name: "Plate", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_plate",
      id: "rect_plate",
      center: [0, 0],
      width: 20,
      height: 12
    },
    { op: "sketch.create", id: "sketch_block", name: "Block", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_block",
      id: "rect_block",
      center: [40, 0],
      width: 10,
      height: 10
    },
    {
      op: "feature.extrude",
      id: "feat_block",
      bodyId: "body_block",
      sketchId: "sketch_block",
      entityId: "rect_block",
      depth: 8
    }
  ]);
}

describe("feature.offset", () => {
  it("offsets a sketch profile, rebuilds when distance changes, and offsets a face without a schema bump", () => {
    const engine = new CadEngine();
    seedPlateAndBlock(engine);

    const profileCreated = engine.apply({
      op: "feature.offset",
      id: "feat_profile_offset",
      bodyId: "body_profile_offset",
      source: {
        kind: "sketchProfile",
        profile: {
          kind: "entity",
          sketchId: "sketch_plate",
          entityId: "rect_plate"
        }
      },
      distance: 4,
      side: "outward"
    });

    expect(profileCreated.transaction.diff).toMatchObject({
      features: {
        created: [
          {
            id: "feat_profile_offset",
            kind: "offset",
            source: {
              kind: "sketchProfile",
              profile: {
                kind: "entity",
                sketchId: "sketch_plate",
                entityId: "rect_plate"
              }
            },
            distance: 4,
            side: "outward",
            bodyId: "body_profile_offset"
          }
        ],
        bodiesCreated: [{ id: "body_profile_offset", kind: "solid" }]
      }
    });
    expect(profileCreated.transaction.diff.sketches?.entitiesCreated).toBeUndefined();

    const rebuilt = engine.apply({
      op: "feature.updateOffset",
      id: "feat_profile_offset",
      distance: 6
    });

    expect(rebuilt.transaction.diff).toMatchObject({
      features: {
        modified: [
          expect.objectContaining({
            id: "feat_profile_offset",
            kind: "offset",
            distance: 6,
            side: "outward",
            bodyId: "body_profile_offset"
          })
        ]
      }
    });
    expect(engine.getDocument().features.get("feat_profile_offset")).toMatchObject({
      kind: "offset",
      distance: 6,
      side: "outward"
    });

    const faceCreated = engine.apply({
      op: "feature.offset",
      id: "feat_face_offset",
      bodyId: "body_face_offset",
      source: {
        kind: "face",
        face: {
          kind: "generatedFace",
          bodyId: "body_block",
          stableId: "generated:face:body_block:endCap"
        }
      },
      distance: 2,
      side: "outward"
    });

    expect(faceCreated.transaction.diff).toMatchObject({
      features: {
        created: [
          {
            id: "feat_face_offset",
            kind: "offset",
            source: {
              kind: "face",
              face: {
                kind: "generatedFace",
                bodyId: "body_block",
                stableId: "generated:face:body_block:endCap"
              }
            },
            distance: 2,
            side: "outward",
            targetBodyId: "body_block",
            bodyId: "body_face_offset"
          }
        ],
        bodiesCreated: [{ id: "body_face_offset", kind: "solid" }]
      }
    });

    const faceRebuilt = engine.apply({
      op: "feature.updateOffset",
      id: "feat_face_offset",
      side: "inward"
    });
    expect(faceRebuilt.transaction.diff).toMatchObject({
      features: {
        modified: [
          expect.objectContaining({
            id: "feat_face_offset",
            kind: "offset",
            distance: 2,
            side: "inward"
          })
        ]
      }
    });

    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    const publicJson = JSON.stringify(structure);
    expect(PRIVATE_ID_PATTERN.test(publicJson)).toBe(false);
    expect(structure).toMatchObject({
      ok: true,
      query: "project.structure",
      features: expect.arrayContaining([
        expect.objectContaining({
          id: "feat_profile_offset",
          kind: "offset",
          distance: 6,
          sourceKind: "sketchProfile"
        }),
        expect.objectContaining({
          id: "feat_face_offset",
          kind: "offset",
          targetBodyId: "body_block",
          sourceKind: "face"
        })
      ]),
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_block",
          consumedByFeatureId: "feat_face_offset"
        }),
        expect.objectContaining({
          id: "body_profile_offset",
          featureId: "feat_profile_offset",
          source: expect.objectContaining({
            type: "offsetFeature",
            distance: 6
          })
        }),
        expect.objectContaining({
          id: "body_face_offset",
          featureId: "feat_face_offset"
        })
      ])
    });

    const exported = exportCadProject(engine);
    expect(exported.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
    expect(exported.schemaVersion).not.toBe("web-cad.project.v23");
    expect(
      exported.document.features.some(
        (feature) => feature.kind === "offset" && feature.id === "feat_profile_offset"
      )
    ).toBe(true);

    const restored = importCadProject(exported);
    const restoredStructure = restored.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(restoredStructure).toMatchObject({
      ok: true,
      features: expect.arrayContaining([
        expect.objectContaining({
          id: "feat_profile_offset",
          kind: "offset",
          distance: 6
        }),
        expect.objectContaining({
          id: "feat_face_offset",
          kind: "offset",
          targetBodyId: "body_block"
        })
      ])
    });
    expect(PRIVATE_ID_PATTERN.test(JSON.stringify(restoredStructure))).toBe(false);
  });
});
