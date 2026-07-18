import { describe, expect, it } from "vitest";
import {
  CAD_PROJECT_FORMAT_VERSION_V20,
  CadEngine,
  DEFAULT_PART_ID,
  createResolvedSweepSource,
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

function expectRejectedAtomically(
  engine: CadEngine,
  op: unknown,
  code: string,
  path?: string
): void {
  const beforeProject = exportCadProject(engine);
  const beforeSnapshot = engine.createSnapshot();
  const beforeTransactions = engine.getTransactions();
  const response = engine.executeBatch({
    version: "cadops.v1",
    mode: "commit",
    ops: [op]
  } as never);

  expect(response).toMatchObject({
    ok: false,
    error: { code, ...(path ? { path } : {}) }
  });
  expect(exportCadProject(engine)).toEqual(beforeProject);
  expect(engine.createSnapshot()).toEqual(beforeSnapshot);
  expect(engine.getTransactions()).toEqual(beforeTransactions);
}

describe("sweep feature", () => {
  it("rejects add/cut and every target field on create and update without consuming state", () => {
    const createCases = [
      {
        patch: { operationMode: "add" },
        code: "UNSUPPORTED_FEATURE_OPERATION",
        path: "$.ops[0].operationMode"
      },
      {
        patch: { operationMode: "cut" },
        code: "UNSUPPORTED_FEATURE_OPERATION",
        path: "$.ops[0].operationMode"
      },
      {
        patch: { targetBodyId: "body_target" },
        code: "TARGET_BODY_NOT_SUPPORTED",
        path: "$.ops[0].targetBodyId"
      },
      {
        patch: { targetTopologyAnchorId: "anchor_target" },
        code: "TARGET_BODY_NOT_SUPPORTED",
        path: "$.ops[0].targetTopologyAnchorId"
      }
    ] as const;

    for (const testCase of createCases) {
      const engine = createSweepEngine();
      expectRejectedAtomically(
        engine,
        {
          op: "feature.sweep",
          profileSketchId: "sketch_profile",
          profileEntityId: "profile",
          pathSketchId: "sketch_path",
          pathEntityIds: ["path"],
          ...testCase.patch
        },
        testCase.code,
        testCase.path
      );
    }

    for (const testCase of createCases) {
      const engine = createSweepEngine();
      engine.apply({
        op: "feature.sweep",
        id: "existing_sweep",
        bodyId: "existing_body",
        profileSketchId: "sketch_profile",
        profileEntityId: "profile",
        pathSketchId: "sketch_path",
        pathEntityIds: ["path"]
      });
      expectRejectedAtomically(
        engine,
        {
          op: "feature.updateSweep",
          id: "existing_sweep",
          path: {
            kind: "entity",
            sketchId: "sketch_path",
            entityId: "path",
            orientation: "forward"
          },
          ...testCase.patch
        },
        testCase.code,
        testCase.path
      );
    }
  });

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
          path: {
            kind: "entity",
            sketchId: "sketch_path",
            entityId: "path",
            orientation: "forward"
          }
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
            path: "path",
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
        operationMode: "newBody",
        path: {
          kind: "entity",
          sketchId: "sketch_path",
          entityId: "path_next",
          orientation: "forward"
        }
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

  it("creates ordered G1 line/arc chains in both orientations and resolves one exact recipe", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "profiles", name: "Profiles", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "profiles",
        id: "forward_profile",
        center: [0, 0],
        radius: 0.2
      },
      {
        op: "sketch.addCircle",
        sketchId: "profiles",
        id: "reverse_profile",
        center: [2, 0],
        radius: 0.2
      },
      { op: "sketch.create", id: "chain", name: "Chain", plane: "XZ" },
      {
        op: "sketch.addLine",
        sketchId: "chain",
        id: "lead",
        start: [0, 0],
        end: [0, 2]
      },
      {
        op: "sketch.addArc",
        sketchId: "chain",
        id: "bend",
        definition: {
          kind: "centerAngles",
          center: [1, 2],
          radius: 1,
          startAngleDegrees: 180,
          sweepAngleDegrees: -180
        }
      },
      {
        op: "sketch.addLine",
        sketchId: "chain",
        id: "tail",
        start: [2, 2],
        end: [2, 0]
      }
    ]);
    const beforeDryRun = exportCadProject(engine);
    const forwardPath = {
      kind: "chain" as const,
      sketchId: "chain",
      segments: ["lead", "bend", "tail"].map((entityId) => ({
        entityId,
        orientation: "forward" as const
      }))
    };
    const reversePath = {
      kind: "chain" as const,
      sketchId: "chain",
      segments: ["tail", "bend", "lead"].map((entityId) => ({
        entityId,
        orientation: "reverse" as const
      }))
    };
    const dryRun = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [
        {
          op: "feature.sweep",
          id: "forward_sweep",
          bodyId: "forward_body",
          operationMode: "newBody",
          profile: {
            kind: "entity",
            sketchId: "profiles",
            entityId: "forward_profile"
          },
          path: forwardPath
        }
      ]
    });
    expect(dryRun).toMatchObject({
      ok: true,
      createdBodyIds: ["forward_body"]
    });
    expect(exportCadProject(engine)).toEqual(beforeDryRun);

    engine.applyBatch([
      {
        op: "feature.sweep",
        id: "forward_sweep",
        bodyId: "forward_body",
        profile: {
          kind: "entity",
          sketchId: "profiles",
          entityId: "forward_profile"
        },
        path: forwardPath
      },
      {
        op: "feature.sweep",
        id: "reverse_sweep",
        bodyId: "reverse_body",
        profile: {
          kind: "entity",
          sketchId: "profiles",
          entityId: "reverse_profile"
        },
        path: reversePath
      }
    ]);

    for (const [featureId, expectedIds] of [
      ["forward_sweep", ["lead", "bend", "tail"]],
      ["reverse_sweep", ["tail", "bend", "lead"]]
    ] as const) {
      const feature = engine.getDocument().features.get(featureId);
      expect(feature).toMatchObject({ kind: "sweep", path: { kind: "chain" } });
      if (feature?.kind !== "sweep") throw new Error("Expected sweep feature.");
      const recipe = createResolvedSweepSource(
        engine.getDocument(),
        feature,
        DEFAULT_PART_ID
      );
      expect(recipe).toMatchObject({
        sourceKind: "authoredSweep",
        pathEntityIds: expectedIds,
        path: { closed: false },
        frameMode: "correctedFrenet",
        solidPolicy: "exactlyOne"
      });
      expect(recipe?.path.segments).toHaveLength(3);
    }
  });

  it("uses V17 feature diagnostics for non-G1 chains and invalid profile/path frames", () => {
    const engine = createSweepEngine("circle");
    engine.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "sketch_path",
        id: "g0",
        start: [0, 8],
        end: [1, 8]
      },
      {
        op: "sketch.addArc",
        sketchId: "sketch_path",
        id: "offset_arc",
        definition: {
          kind: "centerAngles",
          center: [0, 0],
          radius: 1,
          startAngleDegrees: 0,
          sweepAngleDegrees: 90
        }
      }
    ]);
    const profile = {
      kind: "entity" as const,
      sketchId: "sketch_profile",
      entityId: "profile"
    };
    const nonG1 = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.sweep",
          profile,
          path: {
            kind: "chain",
            sketchId: "sketch_path",
            segments: ["path", "g0"].map((entityId) => ({
              entityId,
              orientation: "forward" as const
            }))
          }
        }
      ]
    });
    expect(nonG1).toMatchObject({
      ok: false,
      error: { code: "SKETCH_PATH_JOIN_NOT_TANGENT" }
    });

    const invalidFrame = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.sweep",
          profile,
          path: {
            kind: "entity",
            sketchId: "sketch_path",
            entityId: "offset_arc",
            orientation: "forward"
          }
        }
      ]
    });
    expect(invalidFrame).toMatchObject({
      ok: false,
      error: { code: "SWEEP_PROFILE_PATH_FRAME_INVALID" }
    });
    expect(engine.getDocument().features.size).toBe(0);
  });

  it("rejects every unsupported V17 path and profile row at the command boundary atomically", () => {
    const engine = createSweepEngine("circle");
    engine.applyBatch([
      {
        op: "sketch.addLine",
        sketchId: "sketch_profile",
        id: "profile_line_a",
        start: [0, 0],
        end: [1, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_profile",
        id: "profile_line_b",
        start: [1, 0],
        end: [0, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_path",
        id: "disconnected_a",
        start: [0, 0],
        end: [0, 1]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_path",
        id: "disconnected_b",
        start: [0, 2],
        end: [0, 3]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_path",
        id: "g0_a",
        start: [0, 0],
        end: [0, 1]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_path",
        id: "g0_b",
        start: [0, 1],
        end: [1, 1]
      },
      {
        op: "sketch.addArc",
        sketchId: "sketch_path",
        id: "closed_a",
        definition: {
          kind: "centerAngles",
          center: [0, 0],
          radius: 1,
          startAngleDegrees: 0,
          sweepAngleDegrees: 180
        }
      },
      {
        op: "sketch.addArc",
        sketchId: "sketch_path",
        id: "closed_b",
        definition: {
          kind: "centerAngles",
          center: [0, 0],
          radius: 1,
          startAngleDegrees: 180,
          sweepAngleDegrees: 180
        }
      },
      {
        op: "sketch.addArc",
        sketchId: "sketch_path",
        id: "overlap_a",
        definition: {
          kind: "centerAngles",
          center: [0, 0],
          radius: 1,
          startAngleDegrees: 0,
          sweepAngleDegrees: 270
        }
      },
      {
        op: "sketch.addArc",
        sketchId: "sketch_path",
        id: "overlap_b",
        definition: {
          kind: "centerAngles",
          center: [0, 0],
          radius: 1,
          startAngleDegrees: 270,
          sweepAngleDegrees: 180
        }
      }
    ]);
    const profile = {
      kind: "entity" as const,
      sketchId: "sketch_profile",
      entityId: "profile"
    };
    const chain = (...entityIds: readonly string[]) => ({
      kind: "chain" as const,
      sketchId: "sketch_path",
      segments: entityIds.map((entityId) => ({
        entityId,
        orientation: "forward" as const
      }))
    });
    const cases = [
      {
        profile,
        path: chain("path", "path"),
        code: "SKETCH_PATH_ENTITY_REPEATED",
        pathError: "$.ops[0].path.segments[1].entityId"
      },
      {
        profile,
        path: chain("closed_a", "closed_b"),
        code: "SKETCH_PATH_CLOSED_UNSUPPORTED",
        pathError: "$.ops[0].path"
      },
      {
        profile,
        path: chain("overlap_a", "overlap_b"),
        code: "SKETCH_PATH_SELF_INTERSECTING",
        pathError: "$.ops[0].path"
      },
      {
        profile,
        path: chain("disconnected_a", "disconnected_b"),
        code: "SKETCH_PATH_DISCONNECTED",
        pathError: "$.ops[0].path"
      },
      {
        profile,
        path: chain("g0_a", "g0_b"),
        code: "SKETCH_PATH_JOIN_NOT_TANGENT",
        pathError: "$.ops[0].path"
      },
      {
        profile: {
          kind: "wire",
          sketchId: "sketch_profile",
          segments: ["profile_line_a", "profile_line_b"].map((entityId) => ({
            entityId,
            orientation: "forward" as const
          }))
        },
        path: {
          kind: "entity" as const,
          sketchId: "sketch_path",
          entityId: "path",
          orientation: "forward" as const
        },
        code: "SWEEP_PROFILE_UNSUPPORTED",
        pathError: "$.ops[0].profile"
      }
    ] as const;

    for (const [index, testCase] of cases.entries()) {
      expectRejectedAtomically(
        engine,
        {
          op: "feature.sweep",
          id: `rejected_matrix_sweep_${index}`,
          bodyId: `rejected_matrix_body_${index}`,
          profile: testCase.profile,
          path: testCase.path
        },
        testCase.code,
        testCase.pathError
      );
    }
  });
});
