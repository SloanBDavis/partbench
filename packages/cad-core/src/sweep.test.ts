import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V20,
  CadEngine,
  exportCadProject,
  importCadProject
} from "./index";

function createSweepEngine(
  profile: "rectangle" | "circle" = "rectangle"
): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_profile", name: "Profile", plane: "XY" },
    profile === "rectangle"
      ? {
          op: "sketch.addRectangle",
          sketchId: "sketch_profile",
          id: "profile",
          center: [0, 0],
          width: 2,
          height: 1
        }
      : {
          op: "sketch.addCircle",
          sketchId: "sketch_profile",
          id: "profile",
          center: [0, 0],
          radius: 1
        },
    { op: "sketch.create", id: "sketch_path", name: "Path", plane: "XZ" },
    {
      op: "sketch.addLine",
      sketchId: "sketch_path",
      id: "path",
      start: [0, 0],
      end: [0, 8]
    }
  ]);
  return engine;
}

describe("sweep feature", () => {
  it("rejects construction profiles while allowing construction paths and invalidates existing results", () => {
    const rejectedEngine = createSweepEngine();
    rejectedEngine.apply({
      op: "sketch.setEntityConstruction",
      sketchId: "sketch_profile",
      entityId: "profile",
      construction: true
    });
    const rejected = rejectedEngine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.sweep",
          id: "rejected_sweep",
          bodyId: "rejected_body",
          profileSketchId: "sketch_profile",
          profileEntityId: "profile",
          pathSketchId: "sketch_path",
          pathEntityIds: ["path"]
        }
      ]
    });
    expect(rejected).toMatchObject({
      ok: false,
      error: {
        code: "SKETCH_PROFILE_CONSTRUCTION_ENTITY",
        path: "$.ops[0].profileEntityId",
        expected: "non-construction rectangle or circle entity",
        received: "profile"
      }
    });
    expect(rejectedEngine.getDocument().features.has("rejected_sweep")).toBe(
      false
    );

    const engine = createSweepEngine();
    engine.apply({
      op: "sketch.setEntityConstruction",
      sketchId: "sketch_path",
      entityId: "path",
      construction: true
    });
    engine.apply({
      op: "feature.sweep",
      id: "feat_sweep_construction",
      bodyId: "body_sweep_construction",
      profileSketchId: "sketch_profile",
      profileEntityId: "profile",
      pathSketchId: "sketch_path",
      pathEntityIds: ["path"]
    });
    const sourceBefore = engine
      .getDocument()
      .features.get("feat_sweep_construction");
    const readiness = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.editReadiness",
        edit: {
          editKind: "sketch.setEntityConstruction",
          sketchId: "sketch_profile",
          entityId: "profile",
          construction: true
        }
      }
    });
    expect(readiness).toMatchObject({
      ok: true,
      affected: {
        sketchIds: ["sketch_profile"],
        sketchEntityIds: ["profile"],
        featureIds: ["feat_sweep_construction"],
        bodyIds: ["body_sweep_construction"]
      },
      featureImpacts: [
        expect.objectContaining({
          featureId: "feat_sweep_construction",
          impact: "source-profile"
        })
      ]
    });
    expect(
      engine.getDocument().features.get("feat_sweep_construction")
    ).toEqual(sourceBefore);

    engine.apply({
      op: "sketch.setEntityConstruction",
      sketchId: "sketch_profile",
      entityId: "profile",
      construction: true
    });
    expect(
      engine.getDocument().features.get("feat_sweep_construction")
    ).toEqual(sourceBefore);
    const rebuild = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.rebuildPlan" }
    });
    expect(rebuild).toMatchObject({
      ok: true,
      bodyLifecycles: expect.arrayContaining([
        expect.objectContaining({
          bodyId: "body_sweep_construction",
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
          op: "feature.updateSweep",
          id: "feat_sweep_construction",
          pathEntityIds: ["path"]
        }
      ]
    });
    expect(update).toMatchObject({
      ok: false,
      error: { code: "SKETCH_PROFILE_CONSTRUCTION_ENTITY" }
    });
    expect(
      engine.getDocument().features.get("feat_sweep_construction")
    ).toEqual(sourceBefore);
  });

  it.each(["rectangle", "circle"] as const)(
    "creates, queries, updates, and round-trips a %s profile sweep",
    (profile) => {
      const engine = createSweepEngine(profile);
      const created = engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "feature.sweep",
            id: "feat_sweep",
            bodyId: "body_sweep",
            name: "Rail",
            profileSketchId: "sketch_profile",
            profileEntityId: "profile",
            pathSketchId: "sketch_path",
            pathEntityIds: ["path"]
          }
        ]
      });
      expect(created).toMatchObject({
        ok: true,
        createdFeatureIds: ["feat_sweep"],
        createdBodyIds: ["body_sweep"]
      });
      expect(engine.getDocument().features.get("feat_sweep")).toEqual({
        id: "feat_sweep",
        kind: "sweep",
        name: "Rail",
        profile: {
          kind: "entity",
          sketchId: "sketch_profile",
          entityId: "profile"
        },
        path: {
          kind: "entity",
          sketchId: "sketch_path",
          entityId: "path",
          orientation: "forward"
        },
        bodyId: "body_sweep"
      });

      const dependencyGraph = engine.executeQuery({
        version: "cadops.v1",
        query: { query: "project.dependencyGraph" }
      });
      expect(dependencyGraph).toMatchObject({
        ok: true,
        edges: expect.arrayContaining([
          expect.objectContaining({
            sourceFeatureId: "feat_sweep",
            from: "sketch-entity:sketch_profile:profile"
          }),
          expect.objectContaining({
            sourceFeatureId: "feat_sweep",
            from: "sketch-entity:sketch_path:path"
          })
        ])
      });

      const editability = engine.executeQuery({
        version: "cadops.v1",
        query: {
          query: "feature.editability",
          featureId: "feat_sweep",
          proposedEdit: {
            kind: "sweep",
            pathSketchId: "sketch_path",
            pathEntityIds: ["path"]
          }
        }
      });
      expect(editability).toMatchObject({
        ok: true,
        query: "feature.editability",
        status: "editable",
        rebuildReadiness: { status: "ready" },
        dryRun: {
          status: "valid",
          commitOperation: "feature.updateSweep",
          willMutateDocument: false
        }
      });
      expect(
        editability.ok && editability.query === "feature.editability"
          ? editability.fields
          : []
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "pathEntityIds",
            editable: true,
            commitOperation: "feature.updateSweep"
          })
        ])
      );

      engine.apply({
        op: "sketch.addLine",
        sketchId: "sketch_path",
        id: "path_next",
        start: [0, 0],
        end: [0, 12]
      });
      engine.apply({
        op: "feature.updateSweep",
        id: "feat_sweep",
        pathEntityIds: ["path_next"]
      });
      expect(engine.getDocument().features.get("feat_sweep")).toMatchObject({
        path: {
          kind: "entity",
          sketchId: "sketch_path",
          entityId: "path_next",
          orientation: "forward"
        }
      });

      const exported = exportCadProject(engine);
      expect(exported.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V20);
      const restored = importCadProject(exported);
      expect(restored.getDocument().features.get("feat_sweep")).toEqual(
        engine.getDocument().features.get("feat_sweep")
      );
    }
  );

  it("rejects unsupported, unresolved, and multi-line paths atomically", () => {
    const cases: readonly [unknown, string][] = [
      [[], "SWEEP_PATH_UNSUPPORTED"],
      [["path", "path_2"], "SWEEP_PATH_UNSUPPORTED"],
      [["missing"], "SWEEP_ENTITY_UNRESOLVED"],
      [["profile"], "SWEEP_ENTITY_UNRESOLVED"]
    ];

    for (const [pathEntityIds, code] of cases) {
      const engine = createSweepEngine();
      const response = engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            op: "feature.sweep",
            profileSketchId: "sketch_profile",
            profileEntityId: "profile",
            pathSketchId: "sketch_path",
            pathEntityIds
          }
        ]
      } as never);
      expect(response).toMatchObject({ ok: false, error: { code } });
      expect(engine.getDocument().features.size).toBe(0);
    }
  });
});
