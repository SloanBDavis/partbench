import { describe, expect, it } from "vitest";
import type { CadOp } from "@web-cad/cad-protocol";

import {
  CAD_PROJECT_FORMAT_VERSION_V21,
  CadEngine,
  createCadProjectSourceIdentity,
  exportCadProject,
  exportCadProjectJson,
  exportCadProjectToWcad,
  importCadProject,
  importCadProjectJson,
  readCadProjectWcad
} from "./index";

function createSketchEngine(): CadEngine {
  const engine = new CadEngine();
  engine.apply({
    op: "sketch.create",
    id: "sketch_arc",
    name: "Arc source",
    plane: "XY"
  });
  return engine;
}

function getEntity(engine: CadEngine, id: string) {
  return engine.getDocument().sketches.get("sketch_arc")?.entities.get(id);
}

function captureEngineProofState(engine: CadEngine) {
  const project = exportCadProject(engine);
  return {
    project,
    snapshot: engine.createSnapshot(),
    sourceIdentity: createCadProjectSourceIdentity(project)
  };
}

function executeDryRunWithoutMutation(
  engine: CadEngine,
  ops: readonly CadOp[]
) {
  const before = captureEngineProofState(engine);
  const response = engine.executeBatch({
    version: "cadops.v1",
    mode: "dryRun",
    ops
  });
  expect(response.ok).toBe(true);
  expect(captureEngineProofState(engine)).toEqual(before);
  return response;
}

function expectUndoRedoExact(
  engine: CadEngine,
  before: ReturnType<typeof captureEngineProofState>,
  committed: ReturnType<typeof captureEngineProofState>
): void {
  const committedTransaction = committed.project.history.at(-1)!;
  const undo = engine.undo();
  expect(undo?.transaction).toEqual({
    ...committedTransaction,
    status: "undone"
  });
  expect(engine.createSnapshot()).toEqual(before.snapshot);
  expect(engine.getTransactions()).toEqual(before.project.history);
  expect(engine.getRedoStack()).toEqual([
    { ...committedTransaction, status: "undone" }
  ]);

  const redo = engine.redo();
  expect(redo?.transaction).toEqual(committedTransaction);
  expect(captureEngineProofState(engine)).toEqual(committed);
}

function historyOps(engine: CadEngine) {
  const project = exportCadProject(engine);
  return {
    history: project.history.map((transaction) => transaction.ops),
    redo: project.redoStack.map((transaction) => transaction.ops)
  };
}

describe("V17 arc and construction commands", () => {
  it("canonicalizes center-angle input and preserves signed wrap traversal", () => {
    const engine = createSketchEngine();
    const added = engine.apply({
      op: "sketch.addArc",
      sketchId: "sketch_arc",
      id: "arc_wrap",
      construction: true,
      definition: {
        kind: "centerAngles",
        center: [2, -3],
        radius: 4,
        startAngleDegrees: -10,
        sweepAngleDegrees: 30
      }
    });

    expect(getEntity(engine, "arc_wrap")).toEqual({
      id: "arc_wrap",
      kind: "arc",
      center: [2, -3],
      radius: 4,
      startAngleDegrees: 350,
      sweepAngleDegrees: 30,
      construction: true
    });
    expect(added.transaction.diff.sketches?.entityChanges).toEqual([
      {
        sketchId: "sketch_arc",
        entityId: "arc_wrap",
        action: "added",
        entityKind: "arc",
        changedFields: [
          "center",
          "radius",
          "startAngleDegrees",
          "sweepAngleDegrees",
          "construction"
        ],
        constructionAfter: true
      }
    ]);
  });

  it("canonicalizes three-point arcs in both traversal directions", () => {
    const engine = createSketchEngine();
    engine.applyBatch([
      {
        op: "sketch.addArc",
        sketchId: "sketch_arc",
        id: "arc_ccw",
        definition: {
          kind: "threePoint",
          start: [1, 0],
          pointOnArc: [0, 1],
          end: [-1, 0]
        }
      },
      {
        op: "sketch.addArc",
        sketchId: "sketch_arc",
        id: "arc_cw",
        definition: {
          kind: "threePoint",
          start: [1, 0],
          pointOnArc: [0, -1],
          end: [-1, 0]
        }
      }
    ]);

    expect(getEntity(engine, "arc_ccw")).toMatchObject({
      center: [0, 0],
      radius: 1,
      startAngleDegrees: 0,
      sweepAngleDegrees: 180,
      construction: false
    });
    expect(getEntity(engine, "arc_cw")).toMatchObject({
      center: [0, 0],
      radius: 1,
      startAngleDegrees: 0,
      sweepAngleDegrees: -180,
      construction: false
    });
  });

  it.each([
    {
      code: "SKETCH_ARC_THREE_POINT_COLLINEAR",
      definition: {
        kind: "threePoint" as const,
        start: [0, 0] as const,
        pointOnArc: [1, 0] as const,
        end: [2, 0] as const
      }
    },
    {
      code: "SKETCH_ARC_POINTS_COINCIDENT",
      definition: {
        kind: "threePoint" as const,
        start: [0, 0] as const,
        pointOnArc: [0, 0] as const,
        end: [1, 1] as const
      }
    },
    {
      code: "SKETCH_ARC_RADIUS_INVALID",
      definition: {
        kind: "centerAngles" as const,
        center: [0, 0] as const,
        radius: 0,
        startAngleDegrees: 0,
        sweepAngleDegrees: 90
      }
    },
    {
      code: "SKETCH_ARC_SWEEP_INVALID",
      definition: {
        kind: "centerAngles" as const,
        center: [0, 0] as const,
        radius: 1,
        startAngleDegrees: 0,
        sweepAngleDegrees: 0.05
      }
    },
    {
      code: "SKETCH_ARC_FULL_CIRCLE_USE_CIRCLE",
      definition: {
        kind: "centerAngles" as const,
        center: [0, 0] as const,
        radius: 1,
        startAngleDegrees: 0,
        sweepAngleDegrees: 360
      }
    }
  ])(
    "rejects $code without consuming a generated ID",
    ({ code, definition }) => {
      const engine = createSketchEngine();
      const result = engine.executeBatch({
        version: "cadops.v1",
        mode: "dryRun",
        ops: [{ op: "sketch.addArc", sketchId: "sketch_arc", definition }]
      });

      expect(result).toMatchObject({ ok: false, error: { code } });
      engine.apply({
        op: "sketch.addPoint",
        sketchId: "sketch_arc",
        point: [0, 0]
      });
      expect(getEntity(engine, "skent_1")).toMatchObject({
        kind: "point",
        construction: false
      });
    }
  );

  it("keeps valid dry-run normalization and generated IDs deterministic", () => {
    const engine = createSketchEngine();
    const batch = {
      version: "cadops.v1" as const,
      ops: [
        {
          op: "sketch.addArc" as const,
          sketchId: "sketch_arc",
          definition: {
            kind: "centerAngles" as const,
            center: [0, 0] as const,
            radius: 2,
            startAngleDegrees: 725,
            sweepAngleDegrees: -45
          }
        }
      ]
    };
    const before = exportCadProjectJson(engine);
    const dryRun = engine.executeBatch({ ...batch, mode: "dryRun" });
    const committed = engine.executeBatch({ ...batch, mode: "commit" });

    expect(dryRun.ok).toBe(true);
    expect(committed.ok).toBe(true);
    if (!dryRun.ok || !committed.ok) {
      throw new Error("Expected valid dry-run and commit responses.");
    }
    expect(dryRun.semanticDiff).toEqual(committed.semanticDiff);
    expect(exportCadProjectJson(createSketchEngine())).toBe(before);
    expect(getEntity(engine, "skent_1")).toMatchObject({
      startAngleDegrees: 5,
      sweepAngleDegrees: -45
    });
  });

  it("rejects non-boolean construction without consuming an ID", () => {
    const engine = createSketchEngine();
    const invalid = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [
        {
          op: "sketch.addArc",
          sketchId: "sketch_arc",
          construction: "yes",
          definition: {
            kind: "centerAngles",
            center: [0, 0],
            radius: 1,
            startAngleDegrees: 0,
            sweepAngleDegrees: 90
          }
        } as never
      ]
    });

    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "SKETCH_ENTITY_CONSTRUCTION_INVALID" }
    });
    engine.apply({
      op: "sketch.addPoint",
      sketchId: "sketch_arc",
      point: [0, 0]
    });
    expect(getEntity(engine, "skent_1")).toBeDefined();
  });

  it("updates canonical arcs, rejects kind changes, toggles identity, and deletes", () => {
    const engine = createSketchEngine();
    engine.apply({
      op: "sketch.addArc",
      sketchId: "sketch_arc",
      id: "arc_edit",
      definition: {
        kind: "centerAngles",
        center: [0, 0],
        radius: 2,
        startAngleDegrees: 0,
        sweepAngleDegrees: 90
      }
    });
    const updated = engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_arc",
      entity: {
        id: "arc_edit",
        kind: "arc",
        center: [1, 2],
        radius: 3,
        startAngleDegrees: 370,
        sweepAngleDegrees: -120,
        construction: false
      }
    });
    const toggled = engine.apply({
      op: "sketch.setEntityConstruction",
      sketchId: "sketch_arc",
      entityId: "arc_edit",
      construction: true
    });

    expect(getEntity(engine, "arc_edit")).toMatchObject({
      id: "arc_edit",
      startAngleDegrees: 10,
      construction: true
    });
    expect(updated.transaction.diff.sketches?.entityChanges?.[0]).toMatchObject(
      {
        action: "updated",
        changedFields: [
          "center",
          "radius",
          "startAngleDegrees",
          "sweepAngleDegrees"
        ]
      }
    );
    expect(toggled.transaction.diff.sketches?.entityChanges).toEqual([
      {
        sketchId: "sketch_arc",
        entityId: "arc_edit",
        action: "updated",
        entityKind: "arc",
        changedFields: ["construction"],
        constructionBefore: false,
        constructionAfter: true
      }
    ]);
    expect(() =>
      engine.apply({
        op: "sketch.updateEntity",
        sketchId: "sketch_arc",
        entity: {
          id: "arc_edit",
          kind: "circle",
          center: [0, 0],
          radius: 1,
          construction: true
        }
      })
    ).toThrow(/cannot change an entity kind/);

    const deleted = engine.apply({
      op: "sketch.deleteEntity",
      sketchId: "sketch_arc",
      entityId: "arc_edit"
    });
    expect(getEntity(engine, "arc_edit")).toBeUndefined();
    expect(deleted.transaction.diff.sketches?.entityChanges?.[0]).toMatchObject(
      {
        action: "deleted",
        entityKind: "arc",
        constructionBefore: true
      }
    );
  });

  it("preserves construction for V20 non-arc update payloads", () => {
    const engine = createSketchEngine();
    engine.apply({
      op: "sketch.addLine",
      sketchId: "sketch_arc",
      id: "legacy_line",
      start: [0, 0],
      end: [1, 1],
      construction: true
    });

    const legacyUpdate = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "sketch.updateEntity",
          sketchId: "sketch_arc",
          entity: {
            id: "legacy_line",
            kind: "line",
            start: [2, 3],
            end: [4, 5]
          }
        } as never
      ]
    });

    expect(legacyUpdate.ok).toBe(true);
    expect(getEntity(engine, "legacy_line")).toEqual({
      id: "legacy_line",
      kind: "line",
      start: [2, 3],
      end: [4, 5],
      construction: true
    });
  });

  it("proves arc update dry-run, validation, semantic diff, and history invariants", () => {
    const engine = createSketchEngine();
    engine.apply({
      op: "sketch.addArc",
      sketchId: "sketch_arc",
      id: "arc_history_update",
      definition: {
        kind: "centerAngles",
        center: [0, 0],
        radius: 2,
        startAngleDegrees: 15,
        sweepAngleDegrees: 120
      },
      construction: false
    });
    const before = captureEngineProofState(engine);
    const op = {
      op: "sketch.updateEntity" as const,
      sketchId: "sketch_arc",
      entity: {
        id: "arc_history_update",
        kind: "arc" as const,
        center: [3, 4] as const,
        radius: 5,
        startAngleDegrees: 725,
        sweepAngleDegrees: -80,
        construction: true
      }
    };
    const expectedChange = {
      sketchId: "sketch_arc",
      entityId: "arc_history_update",
      action: "updated",
      entityKind: "arc",
      changedFields: [
        "center",
        "radius",
        "startAngleDegrees",
        "sweepAngleDegrees",
        "construction"
      ],
      constructionBefore: false,
      constructionAfter: true
    };
    const dryRun = executeDryRunWithoutMutation(engine, [op]);
    expect(dryRun.ok && dryRun.semanticDiff.sketches?.entityChanges).toEqual([
      expectedChange
    ]);

    const committedResponse = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [op]
    });
    expect(
      committedResponse.ok &&
        committedResponse.semanticDiff.sketches?.entityChanges
    ).toEqual([expectedChange]);
    expect(getEntity(engine, "arc_history_update")).toEqual({
      ...op.entity,
      startAngleDegrees: 5
    });
    expect(engine.createSnapshot().nextSketchEntityNumber).toBe(
      before.snapshot.nextSketchEntityNumber
    );
    const committed = captureEngineProofState(engine);

    const invalidBefore = captureEngineProofState(engine);
    const invalid = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          ...op,
          entity: { ...op.entity, sweepAngleDegrees: 360 }
        }
      ]
    });
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "SKETCH_ARC_FULL_CIRCLE_USE_CIRCLE" }
    });
    expect(captureEngineProofState(engine)).toEqual(invalidBefore);
    expectUndoRedoExact(engine, before, committed);
  });

  it("proves legacy omitted-construction update dry-run and history invariants", () => {
    const engine = createSketchEngine();
    engine.apply({
      op: "sketch.addLine",
      sketchId: "sketch_arc",
      id: "legacy_history_line",
      start: [0, 0],
      end: [1, 1],
      construction: true
    });
    const before = captureEngineProofState(engine);
    const op = {
      op: "sketch.updateEntity" as const,
      sketchId: "sketch_arc",
      entity: {
        id: "legacy_history_line",
        kind: "line" as const,
        start: [2, 3] as const,
        end: [4, 6] as const
      }
    };
    const expectedChange = {
      sketchId: "sketch_arc",
      entityId: "legacy_history_line",
      action: "updated",
      entityKind: "line",
      changedFields: ["start", "end"]
    };
    const dryRun = executeDryRunWithoutMutation(engine, [op]);
    expect(dryRun.ok && dryRun.semanticDiff.sketches?.entityChanges).toEqual([
      expectedChange
    ]);
    const committedResponse = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [op]
    });
    expect(
      committedResponse.ok &&
        committedResponse.semanticDiff.sketches?.entityChanges
    ).toEqual([expectedChange]);
    expect(getEntity(engine, "legacy_history_line")).toEqual({
      ...op.entity,
      construction: true
    });
    const committed = captureEngineProofState(engine);

    const invalidBefore = captureEngineProofState(engine);
    const invalid = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "sketch.updateEntity",
          sketchId: "sketch_arc",
          entity: {
            id: "legacy_history_line",
            kind: "circle",
            center: [0, 0],
            radius: 1
          }
        }
      ]
    });
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "INVALID_SKETCH_ENTITY" }
    });
    expect(captureEngineProofState(engine)).toEqual(invalidBefore);
    expectUndoRedoExact(engine, before, committed);
  });

  it("proves construction toggle and arc delete dry-run and history invariants", () => {
    const engine = createSketchEngine();
    engine.apply({
      op: "sketch.addArc",
      sketchId: "sketch_arc",
      id: "arc_toggle_delete",
      definition: {
        kind: "centerAngles",
        center: [1, 2],
        radius: 3,
        startAngleDegrees: 30,
        sweepAngleDegrees: -140
      }
    });

    const toggleBefore = captureEngineProofState(engine);
    const toggleOp = {
      op: "sketch.setEntityConstruction" as const,
      sketchId: "sketch_arc",
      entityId: "arc_toggle_delete",
      construction: true
    };
    const toggleChange = {
      sketchId: "sketch_arc",
      entityId: "arc_toggle_delete",
      action: "updated",
      entityKind: "arc",
      changedFields: ["construction"],
      constructionBefore: false,
      constructionAfter: true
    };
    const toggleDryRun = executeDryRunWithoutMutation(engine, [toggleOp]);
    expect(
      toggleDryRun.ok && toggleDryRun.semanticDiff.sketches?.entityChanges
    ).toEqual([toggleChange]);
    const toggleCommit = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [toggleOp]
    });
    expect(
      toggleCommit.ok && toggleCommit.semanticDiff.sketches?.entityChanges
    ).toEqual([toggleChange]);
    const toggled = captureEngineProofState(engine);
    expectUndoRedoExact(engine, toggleBefore, toggled);

    const deleteBefore = captureEngineProofState(engine);
    const deleteOp = {
      op: "sketch.deleteEntity" as const,
      sketchId: "sketch_arc",
      entityId: "arc_toggle_delete"
    };
    const deleteChange = {
      sketchId: "sketch_arc",
      entityId: "arc_toggle_delete",
      action: "deleted",
      entityKind: "arc",
      changedFields: [
        "center",
        "radius",
        "startAngleDegrees",
        "sweepAngleDegrees",
        "construction"
      ],
      constructionBefore: true
    };
    const deleteDryRun = executeDryRunWithoutMutation(engine, [deleteOp]);
    expect(
      deleteDryRun.ok && deleteDryRun.semanticDiff.sketches?.entityChanges
    ).toEqual([deleteChange]);
    const deleteCommit = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [deleteOp]
    });
    expect(
      deleteCommit.ok && deleteCommit.semanticDiff.sketches?.entityChanges
    ).toEqual([deleteChange]);
    expect(getEntity(engine, "arc_toggle_delete")).toBeUndefined();
    expect(engine.createSnapshot().nextSketchEntityNumber).toBe(
      deleteBefore.snapshot.nextSketchEntityNumber
    );
    const deleted = captureEngineProofState(engine);

    const invalidBefore = captureEngineProofState(engine);
    const invalid = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [deleteOp]
    });
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "SKETCH_ENTITY_NOT_FOUND" }
    });
    expect(captureEngineProofState(engine)).toEqual(invalidBefore);
    expectUndoRedoExact(engine, deleteBefore, deleted);
  });

  it("restores exact arc source and counters through undo and redo", () => {
    const engine = createSketchEngine();
    engine.apply({
      op: "sketch.addArc",
      sketchId: "sketch_arc",
      definition: {
        kind: "centerAngles",
        center: [2, 3],
        radius: 4,
        startAngleDegrees: 25,
        sweepAngleDegrees: -200
      },
      construction: true
    });
    const committed = getEntity(engine, "skent_1");

    engine.undo();
    expect(getEntity(engine, "skent_1")).toBeUndefined();
    engine.redo();
    expect(getEntity(engine, "skent_1")).toEqual(committed);
    engine.apply({
      op: "sketch.addCircle",
      sketchId: "sketch_arc",
      center: [0, 0],
      radius: 1
    });
    expect(getEntity(engine, "skent_2")).toMatchObject({ kind: "circle" });
  });

  it("supports explicit same-batch IDs and scales only arc length fields", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_arc", name: "Arc", plane: "XY" },
      {
        op: "sketch.addArc",
        sketchId: "sketch_arc",
        id: "arc_batch",
        definition: {
          kind: "centerAngles",
          center: [10, 20],
          radius: 30,
          startAngleDegrees: 40,
          sweepAngleDegrees: -50
        }
      },
      {
        op: "sketch.setEntityConstruction",
        sketchId: "sketch_arc",
        entityId: "arc_batch",
        construction: true
      }
    ]);
    engine.apply({
      op: "document.updateUnits",
      units: "cm",
      mode: "preservePhysicalSize"
    });

    expect(getEntity(engine, "arc_batch")).toEqual({
      id: "arc_batch",
      kind: "arc",
      center: [1, 2],
      radius: 3,
      startAngleDegrees: 40,
      sweepAngleDegrees: -50,
      construction: true
    });
  });

  it("preserves referenced source edits and reports construction profiles unhealthy", () => {
    const engine = createSketchEngine();
    engine.applyBatch([
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_arc",
        id: "profile_rect",
        center: [0, 0],
        width: 4,
        height: 2
      },
      {
        op: "feature.extrude",
        id: "feature_profile",
        bodyId: "body_profile",
        sketchId: "sketch_arc",
        entityId: "profile_rect",
        depth: 3,
        operationMode: "newBody"
      }
    ]);

    const edit = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "sketch.setEntityConstruction",
          sketchId: "sketch_arc",
          entityId: "profile_rect",
          construction: true
        }
      ]
    });
    const health = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "project.health" }
    });
    const generatedReferences = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "body.generatedReferences",
        bodyId: "body_profile"
      }
    });

    expect(edit).toMatchObject({ ok: true });
    expect(engine.getDocument().features.get("feature_profile")).toBeDefined();
    expect(getEntity(engine, "profile_rect")).toMatchObject({
      construction: true
    });
    expect(health).toMatchObject({
      ok: true,
      authoredExtrudes: [
        expect.objectContaining({
          featureId: "feature_profile",
          status: "unsupported",
          issues: [
            expect.objectContaining({
              code: "PROFILE_KIND_MISMATCH",
              received: "construction geometry"
            })
          ]
        })
      ]
    });
    expect(generatedReferences).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_BODY_REFERENCES" }
    });
  });

  it("rejects construction geometry when creating a solid profile consumer", () => {
    const engine = createSketchEngine();
    engine.apply({
      op: "sketch.addCircle",
      sketchId: "sketch_arc",
      id: "construction_circle",
      center: [0, 0],
      radius: 2,
      construction: true
    });

    const result = engine.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [
        {
          op: "feature.extrude",
          id: "invalid_feature",
          bodyId: "invalid_body",
          sketchId: "sketch_arc",
          entityId: "construction_circle",
          depth: 2,
          operationMode: "newBody"
        }
      ]
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "SKETCH_PROFILE_CONSTRUCTION_ENTITY" }
    });
    expect(engine.getDocument().features.has("invalid_feature")).toBe(false);
  });

  it("exposes arcs through sketch queries and JSON/project round trips", () => {
    const engine = createSketchEngine();
    engine.apply({
      op: "sketch.addArc",
      sketchId: "sketch_arc",
      id: "arc_query",
      definition: {
        kind: "centerAngles",
        center: [1, 1],
        radius: 2,
        startAngleDegrees: 45,
        sweepAngleDegrees: 90
      }
    });
    const get = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "sketch.get", id: "sketch_arc" }
    });
    const evaluation = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "sketch.evaluation", sketchId: "sketch_arc" }
    });
    const readiness = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.editReadiness",
        edit: {
          editKind: "sketch.setEntityConstruction",
          sketchId: "sketch_arc",
          entityId: "arc_query",
          construction: true
        }
      }
    });
    const updateSourceBefore = captureEngineProofState(engine);
    const updateReadiness = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.editReadiness",
        edit: {
          editKind: "sketch.updateEntity",
          sketchId: "sketch_arc",
          entity: {
            id: "arc_query",
            kind: "arc",
            center: [2, 3],
            radius: 4,
            startAngleDegrees: 725,
            sweepAngleDegrees: -120,
            construction: false
          }
        }
      }
    });
    const invalidReadiness = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.editReadiness",
        edit: {
          editKind: "sketch.updateEntity",
          sketchId: "sketch_arc",
          entity: {
            id: "arc_query",
            kind: "arc",
            center: [2, 3],
            radius: 0,
            startAngleDegrees: 0,
            sweepAngleDegrees: 90,
            construction: false
          }
        }
      }
    });
    const solverStatus = engine.executeQuery({
      version: "cadops.v1",
      query: { query: "sketch.solverStatus", sketchId: "sketch_arc" }
    });

    expect(get).toMatchObject({
      ok: true,
      sketch: { entities: [{ id: "arc_query", kind: "arc" }] }
    });
    expect(evaluation).toMatchObject({
      ok: true,
      status: "unsupported",
      issues: [{ code: "UNSUPPORTED_TARGET", sketchEntityId: "arc_query" }]
    });
    expect(readiness).toMatchObject({
      ok: true,
      status: "unsupported",
      dryRun: { status: "unsupported" },
      affected: {
        sketchIds: ["sketch_arc"],
        sketchEntityIds: ["arc_query"]
      },
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: "SKETCH_EDIT_UNSUPPORTED",
          sketchEntityId: "arc_query"
        })
      ])
    });
    expect(updateReadiness).toMatchObject({
      ok: true,
      status: "unsupported",
      dryRun: {
        status: "unsupported",
        willMutateDocument: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: "SKETCH_EDIT_UNSUPPORTED",
            sketchEntityId: "arc_query"
          })
        ])
      },
      affected: {
        sketchIds: ["sketch_arc"],
        sketchEntityIds: ["arc_query"],
        featureIds: [],
        bodyIds: []
      }
    });
    expect(invalidReadiness).toMatchObject({
      ok: true,
      status: "blocked",
      dryRun: {
        status: "blocked",
        willMutateDocument: false,
        diagnostics: [
          {
            code: "SKETCH_EDIT_INVALID_VALUE",
            severity: "blocker",
            message:
              "Arc radius must be finite and greater than the sketch linear tolerance.",
            sketchId: "sketch_arc",
            sketchEntityId: "arc_query",
            fieldPath: "entity.radius",
            expected: ">1e-7",
            received: "0"
          }
        ]
      },
      affected: {
        sketchIds: ["sketch_arc"],
        sketchEntityIds: ["arc_query"],
        featureIds: [],
        bodyIds: []
      }
    });
    expect(solverStatus).toMatchObject({
      ok: true,
      query: "sketch.solverStatus",
      status: "unsupported",
      entities: [
        expect.objectContaining({
          entityId: "arc_query",
          entityKind: "arc",
          supported: false,
          variableCount: 0,
          degreesOfFreedom: 0,
          diagnostics: [
            expect.objectContaining({
              code: "SKETCH_SOLVER_UNSUPPORTED_ENTITY",
              sketchEntityId: "arc_query"
            })
          ]
        })
      ]
    });
    expect(captureEngineProofState(engine)).toEqual(updateSourceBefore);

    const projectRoundTrip = importCadProject(exportCadProject(engine));
    const jsonRoundTrip = importCadProjectJson(exportCadProjectJson(engine));
    expect(getEntity(projectRoundTrip, "arc_query")).toEqual(
      getEntity(engine, "arc_query")
    );
    expect(getEntity(jsonRoundTrip, "arc_query")).toEqual(
      getEntity(engine, "arc_query")
    );
  });

  it("preserves authored V21 and historical update payloads through JSON and WCAD", async () => {
    const engine = createSketchEngine();
    engine.apply({
      op: "sketch.addLine",
      sketchId: "sketch_arc",
      id: "legacy_payload_line",
      start: [0, 0],
      end: [1, 1],
      construction: true
    });
    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_arc",
      entity: {
        id: "legacy_payload_line",
        kind: "line",
        start: [2, 2],
        end: [4, 5]
      }
    });
    engine.apply({
      op: "sketch.addArc",
      sketchId: "sketch_arc",
      id: "arc_payload",
      definition: {
        kind: "centerAngles",
        center: [1, 2],
        radius: 3,
        startAngleDegrees: 20,
        sweepAngleDegrees: 100
      }
    });
    engine.apply({
      op: "sketch.updateEntity",
      sketchId: "sketch_arc",
      entity: {
        id: "arc_payload",
        kind: "arc",
        center: [3, 4],
        radius: 5,
        startAngleDegrees: 380,
        sweepAngleDegrees: -90,
        construction: false
      }
    });
    engine.apply({
      op: "sketch.setEntityConstruction",
      sketchId: "sketch_arc",
      entityId: "arc_payload",
      construction: true
    });
    engine.apply({
      op: "sketch.deleteEntity",
      sketchId: "sketch_arc",
      entityId: "arc_payload"
    });
    engine.undo();

    const source = exportCadProject(engine);
    const expectedOps = historyOps(engine);
    const expectedIdentity = createCadProjectSourceIdentity(source);
    expect(source.schemaVersion).toBe(CAD_PROJECT_FORMAT_VERSION_V21);
    const legacyUpdate = expectedOps.history
      .flat()
      .find(
        (op) =>
          op.op === "sketch.updateEntity" &&
          op.entity.id === "legacy_payload_line"
      );
    expect(legacyUpdate).toEqual({
      op: "sketch.updateEntity",
      sketchId: "sketch_arc",
      entity: {
        id: "legacy_payload_line",
        kind: "line",
        start: [2, 2],
        end: [4, 5]
      }
    });
    if (!legacyUpdate || legacyUpdate.op !== "sketch.updateEntity") {
      throw new Error("Expected historical sketch.updateEntity payload.");
    }
    expect(legacyUpdate.entity).not.toHaveProperty("construction");
    expect(expectedOps.redo[0]?.[0]).toEqual({
      op: "sketch.deleteEntity",
      sketchId: "sketch_arc",
      entityId: "arc_payload"
    });

    const json = exportCadProjectJson(engine);
    const rawJson = JSON.parse(json) as typeof source;
    expect({
      history: rawJson.history.map((transaction) => transaction.ops),
      redo: rawJson.redoStack.map((transaction) => transaction.ops)
    }).toEqual(expectedOps);
    expect(createCadProjectSourceIdentity(rawJson)).toEqual(expectedIdentity);
    const jsonEngine = importCadProjectJson(json);
    expect(historyOps(jsonEngine)).toEqual(expectedOps);
    expect(
      createCadProjectSourceIdentity(exportCadProject(jsonEngine))
    ).toEqual(expectedIdentity);
    expect(getEntity(jsonEngine, "legacy_payload_line")).toMatchObject({
      construction: true
    });
    jsonEngine.redo();
    expect(getEntity(jsonEngine, "arc_payload")).toBeUndefined();

    const packed = await exportCadProjectToWcad(source);
    expect(packed.manifest.document.schemaVersion).toBe(
      CAD_PROJECT_FORMAT_VERSION_V21
    );
    const read = await readCadProjectWcad(packed.bytes);
    expect(read.ok).toBe(true);
    if (!read.ok) {
      return;
    }
    expect(read.sourceIdentity).toEqual(packed.sourceIdentity);
    expect(createCadProjectSourceIdentity(read.project)).toEqual(
      expectedIdentity
    );
    expect({
      history: read.project.history.map((transaction) => transaction.ops),
      redo: read.project.redoStack.map((transaction) => transaction.ops)
    }).toEqual(expectedOps);
    const wcadEngine = importCadProject(read.project);
    expect(historyOps(wcadEngine)).toEqual(expectedOps);
    wcadEngine.redo();
    expect(getEntity(wcadEngine, "arc_payload")).toBeUndefined();
  });
});
