import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V16,
  CAD_PROJECT_FORMAT_VERSION_V20,
  CadEngine,
  exportCadProject,
  importCadProject
} from "./index";

const PRIVATE_ID_PATTERN = /snapshot-local|raw-occt|entitySignature|localId/i;

function seedClevisPlateAndEars(engine: CadEngine): void {
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_plate", name: "Plate", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_plate",
      id: "rect_plate",
      center: [0, 0],
      width: 40,
      height: 40
    },
    {
      op: "feature.extrude",
      id: "feat_plate",
      bodyId: "body_plate",
      sketchId: "sketch_plate",
      entityId: "rect_plate",
      depth: 8
    },
    {
      op: "datum.plane.create",
      id: "datum_ear_a",
      name: "Ear A",
      plane: { kind: "standardPlane", plane: "XZ", offset: 15 }
    },
    {
      op: "datum.plane.create",
      id: "datum_ear_b",
      name: "Ear B",
      plane: { kind: "standardPlane", plane: "XZ", offset: -15 }
    },
    {
      op: "sketch.create",
      id: "sketch_ear_a",
      name: "Ear A",
      datumId: "datum_ear_a"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_ear_a",
      id: "rect_ear_a",
      center: [0, 12],
      width: 16,
      height: 24
    },
    {
      op: "feature.extrude",
      id: "feat_ear_a",
      bodyId: "body_ear_a",
      sketchId: "sketch_ear_a",
      entityId: "rect_ear_a",
      depth: 8
    },
    {
      op: "sketch.create",
      id: "sketch_ear_b",
      name: "Ear B",
      datumId: "datum_ear_b"
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_ear_b",
      id: "rect_ear_b",
      center: [0, 12],
      width: 16,
      height: 24
    },
    {
      op: "feature.extrude",
      id: "feat_ear_b",
      bodyId: "body_ear_b",
      sketchId: "sketch_ear_b",
      entityId: "rect_ear_b",
      depth: 8,
      side: "negative"
    }
  ]);
}

describe("datum.plane.create", () => {
  it("creates a persistent offset datum and sketches on it", () => {
    const engine = new CadEngine();
    const result = engine.applyBatch([
      {
        op: "datum.plane.create",
        id: "datum_ear_a",
        name: "Ear A",
        plane: { kind: "standardPlane", plane: "XZ", offset: 15 }
      },
      {
        op: "sketch.create",
        id: "sketch_ear_a",
        name: "Ear A",
        datumId: "datum_ear_a"
      }
    ]);

    expect(result.transaction.diff).toMatchObject({
      datums: {
        created: [
          {
            id: "datum_ear_a",
            kind: "plane",
            name: "Ear A",
            plane: { kind: "standardPlane", plane: "XZ", offset: 15 }
          }
        ]
      },
      sketches: {
        created: [
          expect.objectContaining({
            id: "sketch_ear_a",
            datumId: "datum_ear_a"
          })
        ]
      }
    });
    expect(engine.getDocument().datums.get("datum_ear_a")).toMatchObject({
      id: "datum_ear_a",
      name: "Ear A",
      kind: "plane",
      plane: { kind: "standardPlane", plane: "XZ", offset: 15 }
    });
  });

  it("creates a datum from a planar generated face", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_plate", name: "Plate", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_plate",
        id: "rect_plate",
        center: [0, 0],
        width: 40,
        height: 40
      },
      {
        op: "feature.extrude",
        id: "feat_plate",
        bodyId: "body_plate",
        sketchId: "sketch_plate",
        entityId: "rect_plate",
        depth: 8
      }
    ]);

    const result = engine.apply({
      op: "datum.plane.create",
      id: "datum_from_face",
      name: "Face offset",
      plane: {
        kind: "generatedFace",
        bodyId: "body_plate",
        stableId: "generated:face:body_plate:endCap",
        offset: 10
      }
    });

    expect(result.transaction.diff).toMatchObject({
      datums: {
        created: [
          {
            id: "datum_from_face",
            kind: "plane",
            name: "Face offset",
            plane: {
              kind: "generatedFace",
              bodyId: "body_plate",
              stableId: "generated:face:body_plate:endCap",
              offset: 10
            }
          }
        ]
      }
    });

    engine.apply({
      op: "sketch.create",
      id: "sketch_on_face_datum",
      name: "On face datum",
      datumId: "datum_from_face"
    });
    expect(engine.getDocument().sketches.get("sketch_on_face_datum")?.datumId).toBe(
      "datum_from_face"
    );
  });

  it("mirrors across a persistent datum using the grown MirrorPlaneRef", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_block", name: "Block", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_block",
        id: "rect_block",
        center: [10, 0],
        width: 8,
        height: 8
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
        op: "datum.plane.create",
        id: "datum_mid",
        name: "Mid",
        plane: { kind: "standardPlane", plane: "YZ", offset: 0 }
      }
    ]);

    const result = engine.apply({
      op: "feature.mirror",
      id: "feat_mirror",
      bodyId: "body_mirrored",
      seedBodyId: "body_block",
      plane: { kind: "datumPlane", datumId: "datum_mid" },
      includeOriginal: true
    });

    expect(result.transaction.diff).toMatchObject({
      features: {
        created: [
          expect.objectContaining({
            id: "feat_mirror",
            kind: "mirror",
            bodyId: "body_mirrored",
            seedBodyId: "body_block"
          })
        ],
        bodiesCreated: [{ id: "body_mirrored", kind: "solid" }]
      }
    });
  });

  it("finishes a clevis: two ear bodies, combine, hole through the ears", () => {
    const engine = new CadEngine();
    seedClevisPlateAndEars(engine);

    const firstUnion = engine.apply({
      op: "feature.combine",
      id: "feat_union_a",
      bodyId: "body_plate_ear_a",
      mode: "union",
      targetBodyId: "body_plate",
      toolBodyId: "body_ear_a"
    });
    expect(firstUnion.transaction.diff).toMatchObject({
      features: {
        created: [
          expect.objectContaining({
            id: "feat_union_a",
            kind: "combine",
            mode: "union",
            targetBodyId: "body_plate",
            toolBodyId: "body_ear_a",
            bodyId: "body_plate_ear_a"
          })
        ],
        bodiesCreated: [{ id: "body_plate_ear_a", kind: "solid" }]
      }
    });

    engine.apply({
      op: "feature.combine",
      id: "feat_union_b",
      bodyId: "body_clevis",
      mode: "union",
      targetBodyId: "body_plate_ear_a",
      toolBodyId: "body_ear_b"
    });

    engine.applyBatch([
      { op: "sketch.create", id: "sketch_pin", name: "Pin", plane: "XZ" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_pin",
        id: "circle_pin",
        center: [0, 16],
        radius: 4
      }
    ]);

    const hole = engine.apply({
      op: "feature.hole",
      id: "feat_pin",
      bodyId: "body_clevis_pin",
      targetBodyId: "body_clevis",
      sketchId: "sketch_pin",
      circleEntityId: "circle_pin",
      depthMode: "throughAll"
    });

    expect(hole.transaction.diff).toMatchObject({
      features: {
        created: [
          expect.objectContaining({
            id: "feat_pin",
            kind: "hole",
            targetBodyId: "body_clevis",
            bodyId: "body_clevis_pin"
          })
        ],
        bodiesCreated: [{ id: "body_clevis_pin", kind: "solid" }]
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
      datums: expect.arrayContaining([
        expect.objectContaining({ id: "datum_ear_a" }),
        expect.objectContaining({ id: "datum_ear_b" })
      ]),
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_ear_a",
          consumedByFeatureId: "feat_union_a"
        }),
        expect.objectContaining({
          id: "body_ear_b",
          consumedByFeatureId: "feat_union_b"
        }),
        expect.objectContaining({
          id: "body_clevis",
          consumedByFeatureId: "feat_pin"
        }),
        expect.objectContaining({
          id: "body_clevis_pin",
          featureId: "feat_pin"
        })
      ])
    });
  });

  it("round-trips datums on existing project schema without a bump", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      {
        op: "datum.plane.create",
        id: "datum_ear_a",
        name: "Ear A",
        plane: { kind: "standardPlane", plane: "XZ", offset: 15 }
      },
      {
        op: "sketch.create",
        id: "sketch_ear_a",
        name: "Ear A",
        datumId: "datum_ear_a"
      },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_ear_a",
        id: "rect_ear_a",
        center: [0, 12],
        width: 16,
        height: 24
      },
      {
        op: "feature.extrude",
        id: "feat_ear_a",
        bodyId: "body_ear_a",
        sketchId: "sketch_ear_a",
        entityId: "rect_ear_a",
        depth: 8
      }
    ]);

    const exported = exportCadProject(engine);
    // Datum records persist on existing v16 the same way combine persisted on
    // existing v20. No web-cad.project.v23/v24 was added.
    expect(exported.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V16);
    expect(exported.document.datums).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "datum_ear_a",
          plane: { kind: "standardPlane", plane: "XZ", offset: 15 }
        })
      ])
    );

    const restored = importCadProject(exported);
    expect(restored.getDocument().datums.get("datum_ear_a")).toMatchObject({
      id: "datum_ear_a",
      plane: { kind: "standardPlane", plane: "XZ", offset: 15 }
    });
    expect(restored.getDocument().sketches.get("sketch_ear_a")?.datumId).toBe(
      "datum_ear_a"
    );
  });

  it("round-trips a combined clevis on existing v20 without a schema bump", () => {
    const engine = new CadEngine();
    seedClevisPlateAndEars(engine);
    engine.apply({
      op: "feature.combine",
      id: "feat_union_a",
      bodyId: "body_plate_ear_a",
      mode: "union",
      targetBodyId: "body_plate",
      toolBodyId: "body_ear_a"
    });
    engine.apply({
      op: "feature.combine",
      id: "feat_union_b",
      bodyId: "body_clevis",
      mode: "union",
      targetBodyId: "body_plate_ear_a",
      toolBodyId: "body_ear_b"
    });

    const exported = exportCadProject(engine);
    expect(exported.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
    expect(exported.document.datums?.some((datum) => datum.id === "datum_ear_a")).toBe(
      true
    );

    const restored = importCadProject(exported);
    const structure = restored.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(PRIVATE_ID_PATTERN.test(JSON.stringify(structure))).toBe(false);
    expect(structure).toMatchObject({
      ok: true,
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_clevis",
          featureId: "feat_union_b"
        })
      ])
    });
  });

  it("rejects sketch.create with both plane and datumId, or neither", () => {
    const engine = new CadEngine();
    expect(() =>
      engine.apply({
        op: "sketch.create",
        id: "sketch_bad",
        name: "Bad"
      })
    ).toThrow(/plane or datumId/);

    engine.apply({
      op: "datum.plane.create",
      id: "datum_ear_a",
      name: "Ear A",
      plane: { kind: "standardPlane", plane: "XZ", offset: 15 }
    });
    expect(() =>
      engine.apply({
        op: "sketch.create",
        id: "sketch_both",
        name: "Both",
        plane: "XY",
        datumId: "datum_ear_a"
      })
    ).toThrow(/plane or datumId/);
  });
});
