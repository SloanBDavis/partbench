import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V16,
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
      center: [20, 0],
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

describe("datum.axis.create", () => {
  it("creates a persistent datum axis and circular-patterns a body around it", () => {
    const engine = new CadEngine();
    seedBlock(engine);

    const created = engine.apply({
      op: "datum.axis.create",
      id: "datum_axis_z",
      name: "Z axis",
      axis: { kind: "globalAxis", axis: "z" }
    });

    expect(created.transaction.diff).toMatchObject({
      datums: {
        created: [
          {
            id: "datum_axis_z",
            kind: "axis",
            name: "Z axis",
            axis: { kind: "globalAxis", axis: "z" }
          }
        ]
      }
    });
    expect(engine.getDocument().datums.get("datum_axis_z")).toMatchObject({
      id: "datum_axis_z",
      kind: "axis",
      axis: { kind: "globalAxis", axis: "z" }
    });

    const patterned = engine.apply({
      op: "feature.circularPattern",
      id: "feat_pattern",
      bodyId: "body_patterned",
      seedBodyId: "body_block",
      rotationAxis: { kind: "datumAxis", datumId: "datum_axis_z" },
      totalAngleDegrees: 360,
      instanceCount: 4
    });

    expect(patterned.transaction.diff).toMatchObject({
      features: {
        created: [
          expect.objectContaining({
            id: "feat_pattern",
            kind: "circularPattern",
            seedBodyId: "body_block",
            rotationAxis: { kind: "datumAxis", datumId: "datum_axis_z" },
            bodyId: "body_patterned"
          })
        ],
        bodiesCreated: [{ id: "body_patterned", kind: "solid" }]
      }
    });

    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(PRIVATE_ID_PATTERN.test(JSON.stringify(structure))).toBe(false);
    expect(structure).toMatchObject({
      ok: true,
      query: "project.structure",
      datums: expect.arrayContaining([
        expect.objectContaining({
          id: "datum_axis_z",
          kind: "axis",
          axis: { kind: "globalAxis", axis: "z" }
        })
      ]),
      features: expect.arrayContaining([
        expect.objectContaining({
          id: "feat_pattern",
          kind: "circularPattern",
          rotationAxis: { kind: "datumAxis", datumId: "datum_axis_z" }
        })
      ]),
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_patterned",
          featureId: "feat_pattern"
        })
      ])
    });
  });

  it("rejects a datum plane as a circular-pattern axis and an axis as a sketch plane", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      {
        op: "datum.plane.create",
        id: "datum_mid",
        name: "Mid",
        plane: { kind: "standardPlane", plane: "YZ", offset: 0 }
      },
      {
        op: "datum.axis.create",
        id: "datum_axis_z",
        name: "Z axis",
        axis: { kind: "globalAxis", axis: "z" }
      }
    ]);

    seedBlock(engine);

    expect(() =>
      engine.apply({
        op: "feature.circularPattern",
        seedBodyId: "body_block",
        rotationAxis: { kind: "datumAxis", datumId: "datum_mid" },
        totalAngleDegrees: 360,
        instanceCount: 4
      })
    ).toThrow(/datum axis/);

    expect(() =>
      engine.apply({
        op: "sketch.create",
        id: "sketch_on_axis",
        name: "On axis",
        datumId: "datum_axis_z"
      })
    ).toThrow(/datum plane/);
  });

  it("round-trips an axis datum on existing project schema without a bump", () => {
    const engine = new CadEngine();
    engine.apply({
      op: "datum.axis.create",
      id: "datum_axis_z",
      name: "Z axis",
      axis: { kind: "globalAxis", axis: "z" }
    });

    const exported = exportCadProject(engine);
    // Axis records persist in the existing datums collection, the same way
    // V24 planes persisted on v16. No web-cad.project.v23/v25 was added.
    expect(exported.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V16);
    expect(exported.schemaVersion).not.toBe("web-cad.project.v23");
    expect(exported.document.datums).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "datum_axis_z",
          kind: "axis",
          axis: { kind: "globalAxis", axis: "z" }
        })
      ])
    );

    const restored = importCadProject(exported);
    expect(restored.getDocument().datums.get("datum_axis_z")).toMatchObject({
      id: "datum_axis_z",
      kind: "axis",
      axis: { kind: "globalAxis", axis: "z" }
    });
  });

  it("round-trips a body circular-patterned around a datum axis on existing v20", () => {
    const engine = new CadEngine();
    seedBlock(engine);
    engine.apply({
      op: "datum.axis.create",
      id: "datum_axis_z",
      name: "Z axis",
      axis: { kind: "globalAxis", axis: "z" }
    });
    engine.apply({
      op: "feature.circularPattern",
      id: "feat_pattern",
      bodyId: "body_patterned",
      seedBodyId: "body_block",
      rotationAxis: { kind: "datumAxis", datumId: "datum_axis_z" },
      totalAngleDegrees: 360,
      instanceCount: 4
    });

    const exported = exportCadProject(engine);
    expect(exported.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
    expect(exported.schemaVersion).not.toBe("web-cad.project.v23");
    expect(
      exported.document.datums?.some(
        (datum) => datum.id === "datum_axis_z" && datum.kind === "axis"
      )
    ).toBe(true);

    const restored = importCadProject(exported);
    const structure = restored.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(PRIVATE_ID_PATTERN.test(JSON.stringify(structure))).toBe(false);
    expect(structure).toMatchObject({
      ok: true,
      datums: expect.arrayContaining([
        expect.objectContaining({ id: "datum_axis_z", kind: "axis" })
      ]),
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_patterned",
          featureId: "feat_pattern"
        })
      ])
    });
  });
});
