import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V20,
  CadEngine,
  exportCadProject,
  importCadProject
} from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

function seedBlock(engine: CadEngine): void {
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_block", name: "Block", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_block",
      id: "rect_block",
      center: [0, 0],
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

describe("feature.draft", () => {
  it("drafts a planar face set of a completed exact solid without a schema bump", () => {
    const engine = new CadEngine();
    seedBlock(engine);

    const created = engine.apply({
      op: "feature.draft",
      id: "feat_draft_side",
      bodyId: "body_draft_side",
      targetBodyId: "body_block",
      faces: [
        {
          kind: "generatedFace",
          bodyId: "body_block",
          stableId: "generated:face:body_block:side:uMax"
        }
      ],
      angleDegrees: 10,
      neutralPlane: {
        kind: "planarFace",
        face: {
          kind: "generatedFace",
          bodyId: "body_block",
          stableId: "generated:face:body_block:startCap"
        }
      }
    });

    expect(created.transaction.diff).toMatchObject({
      features: {
        created: [
          {
            id: "feat_draft_side",
            kind: "draft",
            targetBodyId: "body_block",
            angleDegrees: 10,
            pullDirection: [0, 0, 1],
            draftedFaces: [
              {
                face: {
                  kind: "generatedFace",
                  bodyId: "body_block",
                  stableId: "generated:face:body_block:side:uMax"
                },
                plane: {
                  point: [5, 0, 0],
                  normal: [0.984807753012, 0, 0.173648177667]
                }
              }
            ],
            bodyId: "body_draft_side"
          }
        ],
        bodiesCreated: [{ id: "body_draft_side", kind: "solid" }]
      }
    });
    expect(
      created.transaction.diff.features?.created?.[0]
    ).toMatchObject({
      kind: "draft",
      draftedFaces: [
        {
          plane: {
            normal: [0.984807753012, 0, 0.173648177667]
          }
        }
      ]
    });
    expect(
      (created.transaction.diff.features?.created?.[0] as unknown as {
        draftedFaces: { plane: { normal: number[] } }[];
      }).draftedFaces[0]?.plane.normal[0]
    ).not.toBe(1);

    const invertEngine = new CadEngine();
    seedBlock(invertEngine);
    expect(() =>
      invertEngine.apply({
        op: "feature.draft",
        id: "feat_draft_invert",
        bodyId: "body_draft_invert",
        targetBodyId: "body_block",
        faces: [
          {
            kind: "generatedFace",
            bodyId: "body_block",
            stableId: "generated:face:body_block:side:uMax"
          }
        ],
        angleDegrees: 60,
        neutralPlane: {
          kind: "planarFace",
          face: {
            kind: "generatedFace",
            bodyId: "body_block",
            stableId: "generated:face:body_block:startCap"
          }
        }
      })
    ).toThrow(/invert/);

    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(JSON.stringify(structure)).not.toMatch(PRIVATE_ID_PATTERN);
    expect(structure).toMatchObject({
      ok: true,
      query: "project.structure",
      features: expect.arrayContaining([
        expect.objectContaining({
          id: "feat_draft_side",
          kind: "draft",
          angleDegrees: 10,
          pullDirection: [0, 0, 1]
        })
      ]),
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_block",
          consumedByFeatureId: "feat_draft_side"
        }),
        expect.objectContaining({
          id: "body_draft_side",
          featureId: "feat_draft_side",
          source: expect.objectContaining({
            type: "draftFeature",
            angleDegrees: 10,
            pullDirection: [0, 0, 1]
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
        (feature) => feature.kind === "draft" && feature.id === "feat_draft_side"
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
          id: "feat_draft_side",
          kind: "draft",
          draftedFaces: [
            expect.objectContaining({
              plane: expect.objectContaining({
                normal: [0.984807753012, 0, 0.173648177667]
              })
            })
          ]
        })
      ])
    });

    const undrafted = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.measurements", bodyId: "body_block" }
    });
    const drafted = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "body.measurements", bodyId: "body_draft_side" }
    });
    expect(undrafted).toMatchObject({
      ok: true,
      measurements: { bodyId: "body_block", volume: 800 }
    });
    expect(drafted).toMatchObject({
      ok: true,
      measurements: {
        bodyId: "body_draft_side",
        volume: 743.575366173291
      }
    });
    if (
      undrafted.ok &&
      undrafted.query === "body.measurements" &&
      drafted.ok &&
      drafted.query === "body.measurements"
    ) {
      expect(drafted.measurements.volume).toBeLessThan(
        undrafted.measurements.volume
      );
    }
  });
});
