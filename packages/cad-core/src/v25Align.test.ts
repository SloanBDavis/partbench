import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V20,
  CadEngine,
  exportCadProject,
  importCadProject
} from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

function seedAlignBodies(engine: CadEngine): void {
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_target", name: "Target", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_target",
      id: "rect_target",
      center: [0, 0],
      width: 20,
      height: 20
    },
    {
      op: "feature.extrude",
      id: "feat_target",
      bodyId: "body_target",
      sketchId: "sketch_target",
      entityId: "rect_target",
      depth: 10
    },
    { op: "sketch.create", id: "sketch_source_face", name: "Face source", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_source_face",
      id: "rect_source_face",
      center: [40, 0],
      width: 10,
      height: 10
    },
    {
      op: "feature.extrude",
      id: "feat_source_face",
      bodyId: "body_source_face",
      sketchId: "sketch_source_face",
      entityId: "rect_source_face",
      depth: 8
    },
    { op: "sketch.create", id: "sketch_source_plane", name: "Plane source", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_source_plane",
      id: "rect_source_plane",
      center: [80, 0],
      width: 10,
      height: 10
    },
    {
      op: "feature.extrude",
      id: "feat_source_plane",
      bodyId: "body_source_plane",
      sketchId: "sketch_source_plane",
      entityId: "rect_source_plane",
      depth: 8
    },
    { op: "sketch.create", id: "sketch_source_axis", name: "Axis source", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_source_axis",
      id: "rect_source_axis",
      center: [120, 0],
      width: 10,
      height: 10
    },
    {
      op: "feature.extrude",
      id: "feat_source_axis",
      bodyId: "body_source_axis",
      sketchId: "sketch_source_axis",
      entityId: "rect_source_axis",
      depth: 8
    },
    {
      op: "datum.plane.create",
      id: "datum_xy_20",
      name: "XY 20",
      plane: { kind: "standardPlane", plane: "XY", offset: 20 }
    },
    {
      op: "datum.axis.create",
      id: "datum_axis_z",
      name: "Z axis",
      axis: { kind: "globalAxis", axis: "z" }
    }
  ]);
}

describe("feature.align", () => {
  it("moves a completed exact body onto a planar face, datum plane, and datum axis without a schema bump", () => {
    const engine = new CadEngine();
    seedAlignBodies(engine);

    const ontoFace = engine.apply({
      op: "feature.align",
      id: "feat_align_face",
      bodyId: "body_align_face",
      seedBodyId: "body_source_face",
      sourceFace: {
        kind: "generatedFace",
        bodyId: "body_source_face",
        stableId: "generated:face:body_source_face:endCap"
      },
      target: {
        kind: "planarFace",
        face: {
          kind: "generatedFace",
          bodyId: "body_target",
          stableId: "generated:face:body_target:endCap"
        }
      }
    });

    expect(ontoFace.transaction.diff).toMatchObject({
      features: {
        created: [
          {
            id: "feat_align_face",
            kind: "align",
            seedBodyId: "body_source_face",
            target: {
              kind: "planarFace",
              face: {
                kind: "generatedFace",
                bodyId: "body_target",
                stableId: "generated:face:body_target:endCap"
              }
            },
            transform: {
              translation: [0, 0, 2],
              rotationDegrees: 0
            },
            alignedSourceFace: {
              point: [40, 0, 10],
              normal: [0, 0, 1]
            },
            bodyId: "body_align_face"
          }
        ],
        bodiesCreated: [{ id: "body_align_face", kind: "solid" }]
      }
    });

    const ontoPlane = engine.apply({
      op: "feature.align",
      id: "feat_align_plane",
      bodyId: "body_align_plane",
      seedBodyId: "body_source_plane",
      sourceFace: {
        kind: "generatedFace",
        bodyId: "body_source_plane",
        stableId: "generated:face:body_source_plane:endCap"
      },
      target: { kind: "datumPlane", datumId: "datum_xy_20" }
    });

    expect(ontoPlane.transaction.diff).toMatchObject({
      features: {
        created: [
          {
            id: "feat_align_plane",
            kind: "align",
            seedBodyId: "body_source_plane",
            target: { kind: "datumPlane", datumId: "datum_xy_20" },
            transform: {
              translation: [0, 0, 12],
              rotationDegrees: 0
            },
            alignedSourceFace: {
              point: [80, 0, 20],
              normal: [0, 0, 1]
            },
            bodyId: "body_align_plane"
          }
        ]
      }
    });

    const ontoAxis = engine.apply({
      op: "feature.align",
      id: "feat_align_axis",
      bodyId: "body_align_axis",
      seedBodyId: "body_source_axis",
      sourceFace: {
        kind: "generatedFace",
        bodyId: "body_source_axis",
        stableId: "generated:face:body_source_axis:side:uMax"
      },
      target: { kind: "datumAxis", datumId: "datum_axis_z" }
    });

    expect(ontoAxis.transaction.diff).toMatchObject({
      features: {
        created: [
          {
            id: "feat_align_axis",
            kind: "align",
            seedBodyId: "body_source_axis",
            target: { kind: "datumAxis", datumId: "datum_axis_z" },
            transform: {
              translation: [-125, 0, 0],
              rotationDegrees: 0
            },
            alignedSourceFace: {
              point: [0, 0, 4],
              normal: [1, 0, 0]
            },
            bodyId: "body_align_axis"
          }
        ]
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
      features: expect.arrayContaining([
        expect.objectContaining({
          id: "feat_align_face",
          kind: "align",
          transform: expect.objectContaining({ translation: [0, 0, 2] })
        }),
        expect.objectContaining({
          id: "feat_align_plane",
          kind: "align",
          transform: expect.objectContaining({ translation: [0, 0, 12] })
        }),
        expect.objectContaining({
          id: "feat_align_axis",
          kind: "align",
          transform: expect.objectContaining({ translation: [-125, 0, 0] })
        })
      ]),
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_source_face",
          consumedByFeatureId: "feat_align_face"
        }),
        expect.objectContaining({
          id: "body_align_face",
          featureId: "feat_align_face",
          source: expect.objectContaining({
            type: "alignFeature",
            transform: expect.objectContaining({ translation: [0, 0, 2] }),
            alignedSourceFace: expect.objectContaining({
              point: [40, 0, 10],
              normal: [0, 0, 1]
            })
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
        (feature) => feature.kind === "align" && feature.id === "feat_align_face"
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
          id: "feat_align_face",
          kind: "align",
          transform: expect.objectContaining({ translation: [0, 0, 2] })
        }),
        expect.objectContaining({
          id: "feat_align_axis",
          kind: "align",
          target: { kind: "datumAxis", datumId: "datum_axis_z" }
        })
      ]),
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_align_plane",
          featureId: "feat_align_plane",
          source: expect.objectContaining({
            type: "alignFeature",
            transform: expect.objectContaining({ translation: [0, 0, 12] })
          })
        })
      ])
    });
  });
});
