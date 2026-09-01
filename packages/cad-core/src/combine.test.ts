import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V20,
  CadEngine,
  exportCadProject,
  importCadProject
} from "./index";

function seedTwoCoaxialCylinders(engine: CadEngine): void {
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_hub", name: "Hub", plane: "XY" },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_hub",
      id: "circle_hub",
      center: [0, 0],
      radius: 20
    },
    {
      op: "feature.extrude",
      id: "feat_hub",
      bodyId: "body_hub",
      sketchId: "sketch_hub",
      entityId: "circle_hub",
      depth: 10
    },
    {
      op: "sketch.createOnFace",
      id: "sketch_step",
      name: "Step",
      bodyId: "body_hub",
      faceStableId: "generated:face:body_hub:endCap"
    },
    {
      op: "sketch.addCircle",
      sketchId: "sketch_step",
      id: "circle_step",
      center: [0, 0],
      radius: 12
    },
    {
      op: "feature.extrude",
      id: "feat_step",
      bodyId: "body_step",
      sketchId: "sketch_step",
      entityId: "circle_step",
      depth: 8
    }
  ]);
}

describe("feature.combine", () => {
  it("unions two completed exact solids into one result body", () => {
    const engine = new CadEngine();
    seedTwoCoaxialCylinders(engine);

    const result = engine.apply({
      op: "feature.combine",
      id: "feat_union",
      bodyId: "body_pulley",
      mode: "union",
      targetBodyId: "body_hub",
      toolBodyId: "body_step"
    });

    expect(result.transaction.diff).toMatchObject({
      features: {
        created: [
          {
            id: "feat_union",
            kind: "combine",
            mode: "union",
            targetBodyId: "body_hub",
            toolBodyId: "body_step",
            bodyId: "body_pulley"
          }
        ],
        bodiesCreated: [{ id: "body_pulley", kind: "solid" }]
      }
    });

    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(structure).toMatchObject({
      ok: true,
      query: "project.structure",
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_hub",
          consumedByFeatureId: "feat_union"
        }),
        expect.objectContaining({
          id: "body_step",
          consumedByFeatureId: "feat_union"
        }),
        expect.objectContaining({
          id: "body_pulley",
          featureId: "feat_union",
          source: expect.objectContaining({
            type: "combineFeature",
            mode: "union",
            targetBodyId: "body_hub",
            toolBodyId: "body_step"
          })
        })
      ])
    });
  });

  it("subtracts one completed exact solid from another", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_stock", name: "Stock", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_stock",
        id: "rect_stock",
        center: [0, 0],
        width: 20,
        height: 20
      },
      {
        op: "feature.extrude",
        id: "feat_stock",
        bodyId: "body_stock",
        sketchId: "sketch_stock",
        entityId: "rect_stock",
        depth: 10
      },
      { op: "sketch.create", id: "sketch_cutter", name: "Cutter", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_cutter",
        id: "circle_cutter",
        center: [0, 0],
        radius: 4
      },
      {
        op: "feature.extrude",
        id: "feat_cutter",
        bodyId: "body_cutter",
        sketchId: "sketch_cutter",
        entityId: "circle_cutter",
        depth: 10
      }
    ]);

    const result = engine.apply({
      op: "feature.combine",
      id: "feat_subtract",
      bodyId: "body_pocket",
      mode: "subtract",
      targetBodyId: "body_stock",
      toolBodyId: "body_cutter"
    });

    expect(result.transaction.diff).toMatchObject({
      features: {
        created: [
          {
            id: "feat_subtract",
            kind: "combine",
            mode: "subtract",
            targetBodyId: "body_stock",
            toolBodyId: "body_cutter",
            bodyId: "body_pocket"
          }
        ],
        bodiesCreated: [{ id: "body_pocket", kind: "solid" }]
      }
    });
  });

  it("bores a hole through a combined pulley solid", () => {
    const engine = new CadEngine();
    seedTwoCoaxialCylinders(engine);
    engine.apply({
      op: "feature.combine",
      id: "feat_union",
      bodyId: "body_pulley",
      mode: "union",
      targetBodyId: "body_hub",
      toolBodyId: "body_step"
    });
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_bore", name: "Bore", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_bore",
        id: "circle_bore",
        center: [0, 0],
        radius: 6
      }
    ]);

    const result = engine.apply({
      op: "feature.hole",
      id: "feat_bore",
      bodyId: "body_bored",
      targetBodyId: "body_pulley",
      sketchId: "sketch_bore",
      circleEntityId: "circle_bore",
      depthMode: "throughAll"
    });

    expect(result.transaction.diff).toMatchObject({
      features: {
        created: [
          expect.objectContaining({
            id: "feat_bore",
            kind: "hole",
            targetBodyId: "body_pulley",
            bodyId: "body_bored"
          })
        ],
        bodiesCreated: [{ id: "body_bored", kind: "solid" }]
      }
    });

    const structure = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.structure" }
    });
    expect(structure).toMatchObject({
      ok: true,
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_pulley",
          consumedByFeatureId: "feat_bore"
        }),
        expect.objectContaining({
          id: "body_bored",
          featureId: "feat_bore"
        })
      ])
    });
  });

  it("rejects non-solid, consumed, or identical combine inputs", () => {
    const engine = new CadEngine();
    seedTwoCoaxialCylinders(engine);
    engine.apply({
      op: "feature.combine",
      id: "feat_union",
      bodyId: "body_pulley",
      mode: "union",
      targetBodyId: "body_hub",
      toolBodyId: "body_step"
    });

    expect(() =>
      engine.apply({
        op: "feature.combine",
        mode: "union",
        targetBodyId: "body_hub",
        toolBodyId: "body_pulley"
      })
    ).toThrow(/consumed/);

    expect(() =>
      engine.apply({
        op: "feature.combine",
        mode: "union",
        targetBodyId: "body_pulley",
        toolBodyId: "body_pulley"
      })
    ).toThrow(/distinct/);
  });

  it("round-trips combine on existing project schema without a bump", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_hub", name: "Hub", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_hub",
        id: "circle_hub",
        center: [0, 0],
        radius: 20
      },
      {
        op: "feature.extrude",
        id: "feat_hub",
        bodyId: "body_hub",
        sketchId: "sketch_hub",
        entityId: "circle_hub",
        depth: 10
      },
      { op: "sketch.create", id: "sketch_step", name: "Step", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_step",
        id: "circle_step",
        center: [0, 0],
        radius: 12
      },
      {
        op: "feature.extrude",
        id: "feat_step",
        bodyId: "body_step",
        sketchId: "sketch_step",
        entityId: "circle_step",
        depth: 8
      },
      {
        op: "feature.combine",
        id: "feat_union",
        bodyId: "body_pulley",
        mode: "union",
        targetBodyId: "body_hub",
        toolBodyId: "body_step"
      }
    ]);

    const exported = exportCadProject(engine);
    // Combine is stored like mirror/pattern on existing v20.
    // serializeFeatureForV22 already clones non-extrude features.
    // No web-cad.project.v23/v24 was added.
    expect(exported.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
    expect(
      exported.document.features.some(
        (feature) => feature.kind === "combine" && feature.id === "feat_union"
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
          id: "feat_union",
          kind: "combine",
          mode: "union",
          targetBodyId: "body_hub",
          toolBodyId: "body_step"
        })
      ]),
      bodies: expect.arrayContaining([
        expect.objectContaining({
          id: "body_pulley",
          featureId: "feat_union"
        })
      ])
    });
  });

  it("keeps sketch-on-face pulley persist on existing v22, not a new schema", () => {
    const engine = new CadEngine();
    seedTwoCoaxialCylinders(engine);
    engine.apply({
      op: "feature.combine",
      id: "feat_union",
      bodyId: "body_pulley",
      mode: "union",
      targetBodyId: "body_hub",
      toolBodyId: "body_step"
    });

    const exported = exportCadProject(engine);
    expect(exported.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
    expect(exported.schemaVersion).not.toBe("web-cad.project.v23");
    expect(exported.schemaVersion).not.toBe("web-cad.project.v24");
    expect(
      exported.document.features.some((feature) => feature.kind === "combine")
    ).toBe(true);
  });
});
