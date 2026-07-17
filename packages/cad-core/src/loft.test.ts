import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V20,
  CadEngine,
  exportCadProject,
  importCadProject
} from "./index";

function createLoftEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_base", name: "Base", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_base",
      id: "base_profile",
      center: [0, 0],
      width: 4,
      height: 3
    }
  ]);
  engine.apply({
    op: "feature.extrude",
    id: "feat_pedestal",
    bodyId: "body_pedestal",
    sketchId: "sketch_base",
    entityId: "base_profile",
    depth: 5
  });
  engine.apply({
    op: "sketch.createOnFace",
    id: "sketch_top",
    name: "Top",
    bodyId: "body_pedestal",
    faceStableId: "generated:face:body_pedestal:endCap"
  });
  engine.applyBatch([
    {
      op: "sketch.addCircle",
      sketchId: "sketch_top",
      id: "top_circle",
      center: [0, 0],
      radius: 1
    },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_top",
      id: "top_rectangle",
      center: [0, 0],
      width: 2,
      height: 1
    }
  ]);
  return engine;
}

describe("loft feature", () => {
  it("rejects construction sections and invalidates an existing loft source", () => {
    const rejectedEngine = createLoftEngine();
    rejectedEngine.apply({
      op: "sketch.setEntityConstruction",
      sketchId: "sketch_top",
      entityId: "top_circle",
      construction: true
    });
    const rejected = rejectedEngine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.loft",
          id: "rejected_loft",
          bodyId: "rejected_loft_body",
          sections: [
            { sketchId: "sketch_base", entityId: "base_profile" },
            { sketchId: "sketch_top", entityId: "top_circle" }
          ]
        }
      ]
    });
    expect(rejected).toMatchObject({
      ok: false,
      error: {
        code: "SKETCH_PROFILE_CONSTRUCTION_ENTITY",
        path: "$.ops[0].sections.1.entityId",
        expected: "non-construction rectangle or circle entity",
        received: "top_circle"
      }
    });
    expect(rejectedEngine.getDocument().features.has("rejected_loft")).toBe(
      false
    );

    const engine = createLoftEngine();
    engine.apply({
      op: "feature.loft",
      id: "feat_loft_construction",
      bodyId: "body_loft_construction",
      sections: [
        { sketchId: "sketch_base", entityId: "base_profile" },
        { sketchId: "sketch_top", entityId: "top_circle" }
      ]
    });
    const sourceBefore = engine
      .getDocument()
      .features.get("feat_loft_construction");
    const readiness = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.editReadiness",
        edit: {
          editKind: "sketch.setEntityConstruction",
          sketchId: "sketch_top",
          entityId: "top_circle",
          construction: true
        }
      }
    });
    expect(readiness).toMatchObject({
      ok: true,
      affected: {
        sketchIds: ["sketch_top"],
        sketchEntityIds: ["top_circle"],
        featureIds: ["feat_loft_construction"],
        bodyIds: ["body_loft_construction"]
      },
      featureImpacts: [
        expect.objectContaining({
          featureId: "feat_loft_construction",
          impact: "source-profile"
        })
      ]
    });
    expect(engine.getDocument().features.get("feat_loft_construction")).toEqual(
      sourceBefore
    );

    engine.apply({
      op: "sketch.setEntityConstruction",
      sketchId: "sketch_top",
      entityId: "top_circle",
      construction: true
    });
    expect(engine.getDocument().features.get("feat_loft_construction")).toEqual(
      sourceBefore
    );
    const rebuild = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.rebuildPlan" }
    });
    expect(rebuild).toMatchObject({
      ok: true,
      bodyLifecycles: expect.arrayContaining([
        expect.objectContaining({
          bodyId: "body_loft_construction",
          primaryState: "stale",
          states: expect.arrayContaining(["unsupported", "stale"]),
          commandReady: false,
          diagnostics: expect.arrayContaining([
            expect.objectContaining({ code: "REBUILD_BODY_UNSUPPORTED" })
          ])
        })
      ])
    });
    const update = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.updateLoft",
          id: "feat_loft_construction",
          sections: [
            { sketchId: "sketch_base", entityId: "base_profile" },
            { sketchId: "sketch_top", entityId: "top_circle" }
          ]
        }
      ]
    });
    expect(update).toMatchObject({
      ok: false,
      error: { code: "SKETCH_PROFILE_CONSTRUCTION_ENTITY" }
    });
    expect(engine.getDocument().features.get("feat_loft_construction")).toEqual(
      sourceBefore
    );
  });

  it("creates, queries, updates, and round-trips a separated face-attached loft", () => {
    const engine = createLoftEngine();
    const created = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.loft",
          id: "feat_loft",
          bodyId: "body_loft",
          name: "Transition",
          sections: [
            { sketchId: "sketch_base", entityId: "base_profile" },
            { sketchId: "sketch_top", entityId: "top_circle" }
          ]
        }
      ]
    });

    expect(created).toMatchObject({
      ok: true,
      createdFeatureIds: ["feat_loft"],
      createdBodyIds: ["body_loft"]
    });
    expect(engine.getDocument().features.get("feat_loft")).toEqual({
      id: "feat_loft",
      kind: "loft",
      name: "Transition",
      sections: [
        {
          profile: {
            kind: "entity",
            sketchId: "sketch_base",
            entityId: "base_profile"
          }
        },
        {
          profile: {
            kind: "entity",
            sketchId: "sketch_top",
            entityId: "top_circle"
          }
        }
      ],
      bodyId: "body_loft"
    });

    const editability = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "feature.editability",
        featureId: "feat_loft",
        proposedEdit: {
          kind: "loft",
          sections: [
            { sketchId: "sketch_base", entityId: "base_profile" },
            { sketchId: "sketch_top", entityId: "top_rectangle" }
          ]
        }
      }
    });
    expect(editability).toMatchObject({
      ok: true,
      status: "editable",
      rebuildReadiness: { status: "ready" },
      dryRun: { status: "valid", commitOperation: "feature.updateLoft" }
    });

    const graph = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.dependencyGraph" }
    });
    expect(graph).toMatchObject({
      ok: true,
      edges: expect.arrayContaining([
        expect.objectContaining({
          sourceFeatureId: "feat_loft",
          from: "sketch-entity:sketch_base:base_profile"
        }),
        expect.objectContaining({
          sourceFeatureId: "feat_loft",
          from: "sketch-entity:sketch_top:top_circle"
        })
      ])
    });

    engine.apply({
      op: "feature.updateLoft",
      id: "feat_loft",
      sections: [
        { sketchId: "sketch_base", entityId: "base_profile" },
        { sketchId: "sketch_top", entityId: "top_rectangle" }
      ]
    });
    expect(engine.getDocument().features.get("feat_loft")).toMatchObject({
      sections: [
        {
          profile: {
            kind: "entity",
            sketchId: "sketch_base",
            entityId: "base_profile"
          }
        },
        {
          profile: {
            kind: "entity",
            sketchId: "sketch_top",
            entityId: "top_rectangle"
          }
        }
      ]
    });

    const exported = exportCadProject(engine);
    expect(exported.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
    expect(
      importCadProject(exported).getDocument().features.get("feat_loft")
    ).toEqual(engine.getDocument().features.get("feat_loft"));
  });

  it("rejects unsupported, duplicate, coplanar, and non-parallel sections atomically", () => {
    const engine = createLoftEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_free_xy", name: "XY", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_free_xy",
        id: "free_xy",
        center: [0, 0],
        radius: 1
      },
      { op: "sketch.create", id: "sketch_free_xz", name: "XZ", plane: "XZ" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_free_xz",
        id: "free_xz",
        center: [0, 0],
        radius: 1
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_free_xy",
        id: "line",
        start: [0, 0],
        end: [1, 0]
      }
    ]);
    const cases = [
      {
        sections: [{ sketchId: "sketch_base", entityId: "base_profile" }],
        code: "LOFT_SECTION_UNSUPPORTED"
      },
      {
        sections: [
          { sketchId: "sketch_base", entityId: "base_profile" },
          { sketchId: "sketch_base", entityId: "base_profile" }
        ],
        code: "LOFT_SECTION_DUPLICATE"
      },
      {
        sections: [
          { sketchId: "sketch_base", entityId: "base_profile" },
          { sketchId: "sketch_free_xy", entityId: "free_xy" }
        ],
        code: "LOFT_SECTIONS_COPLANAR"
      },
      {
        sections: [
          { sketchId: "sketch_base", entityId: "base_profile" },
          { sketchId: "sketch_free_xz", entityId: "free_xz" }
        ],
        code: "LOFT_SECTION_FRAME_INVALID"
      },
      {
        sections: [
          { sketchId: "sketch_free_xy", entityId: "line" },
          { sketchId: "sketch_top", entityId: "top_circle" }
        ],
        code: "LOFT_SECTION_UNSUPPORTED"
      }
    ] as const;

    for (const testCase of cases) {
      const response = engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [{ op: "feature.loft", sections: testCase.sections }]
      });
      expect(response).toMatchObject({
        ok: false,
        error: { code: testCase.code }
      });
      expect(engine.getDocument().features.has("feat_loft")).toBe(false);
    }
  });
});
