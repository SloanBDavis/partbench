import { describe, expect, it } from "vitest";
import type {
  CadBatchResponse,
  PreparedSketchCurveEditOp,
  SketchCurveEditProposal
} from "@web-cad/cad-protocol";

import {
  AsyncCadCommandExecutor,
  CadEngine,
  SnapshotCadCommandWorker,
  exportCadProject,
  importCadProject
} from "./index";

type ReadyCurveEdit = Extract<
  ReturnType<CadEngine["executeQuery"]>,
  {
    readonly ok: true;
    readonly query: "sketch.curveEditReadiness";
    readonly status: "ready";
  }
>;

function readiness(
  engine: CadEngine,
  proposal: SketchCurveEditProposal
): ReadyCurveEdit {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: { query: "sketch.curveEditReadiness", proposal }
  });
  if (
    !response.ok ||
    response.query !== "sketch.curveEditReadiness" ||
    response.status !== "ready"
  ) {
    throw new Error(`Expected ready curve edit: ${JSON.stringify(response)}`);
  }
  return response;
}

function expectBatchError(
  response: CadBatchResponse,
  code: string
): Extract<CadBatchResponse, { readonly ok: false }> {
  expect(response.ok).toBe(false);
  if (response.ok) throw new Error("Expected a failed batch.");
  expect(response.error.code).toBe(code);
  return response;
}

function lineEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Edit", plane: "XY" },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "target",
      start: [0, 0],
      end: [10, 0]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "boundary_a",
      start: [3, -2],
      end: [3, 2]
    },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "boundary_b",
      start: [7, -2],
      end: [7, 2]
    }
  ]);
  return engine;
}

describe("V19 curve-edit engine vertical slice", () => {
  it("returns a fully prepared trim and preserves dry-run/commit parity", () => {
    const engine = lineEngine();
    const ready = readiness(engine, {
      kind: "trim",
      sketchId: "sketch_1",
      entityId: "target",
      boundaryEntityIds: ["boundary_a", "boundary_b"],
      pickPoint: [5, 0]
    });

    expect(ready.preview.resultEntityCount).toBe(2);
    expect(ready.preview.intersections).toEqual([
      expect.objectContaining({ boundaryEntityId: "boundary_a" }),
      expect.objectContaining({ boundaryEntityId: "boundary_b" })
    ]);
    expect(ready.preparedOperation.op).toBe("sketch.trim");
    expect(ready.impact.requiredDeleteConstraintIds).toEqual([]);
    expect(ready.impact.requiredDeleteDimensionIds).toEqual([]);

    const dryRun = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [ready.preparedOperation]
    });
    expect(dryRun.ok).toBe(true);
    if (!dryRun.ok) return;

    const committed = engine.apply(ready.preparedOperation);
    expect(committed.transaction.diff).toEqual(dryRun.semanticDiff);
    expect(committed.transaction.diff.sketches?.curveEdits?.[0]).toMatchObject({
      operation: "trim",
      createdEntityIds:
        ready.preparedOperation.op === "sketch.trim"
          ? ready.preparedOperation.createdEntityIds
          : [],
      modifiedEntityIds: ["target"],
      deletedEntityIds: []
    });
  });

  it("previews and applies the exact extend boundary hit", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Edit", plane: "XY" },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "target",
        start: [0, 0],
        end: [3, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "boundary",
        start: [5, -1],
        end: [5, 1]
      }
    ]);
    const ready = readiness(engine, {
      kind: "extend",
      sketchId: "sketch_1",
      entityId: "target",
      endpoint: "end",
      boundaryEntityIds: ["boundary"]
    });

    expect(ready.preview.intersections).toEqual([
      {
        boundaryEntityId: "boundary",
        point: [5, 0],
        targetParameter: 5
      }
    ]);
    engine.apply(ready.preparedOperation);
    expect(
      engine.getDocument().sketches.get("sketch_1")?.entities.get("target")
    ).toMatchObject({ kind: "line", start: [0, 0], end: [5, 0] });
  });

  it("checks stale source before solver identity and does not consume IDs", () => {
    const engine = lineEngine();
    const first = readiness(engine, {
      kind: "split",
      sketchId: "sketch_1",
      entityId: "target",
      splitPoints: [[5, 0]]
    });
    if (first.preparedOperation.op !== "sketch.split") {
      throw new Error("Expected prepared split.");
    }
    engine.apply({
      op: "scene.createBox",
      id: "unrelated_box",
      dimensions: { width: 1, height: 1, depth: 1 }
    });

    const stale = expectBatchError(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            ...first.preparedOperation,
            precondition: {
              expectedSourceRevision:
                first.preparedOperation.precondition.expectedSourceRevision,
              expectedSolverEvaluationIdentity: `partbench-sketch-solver-evaluation-v1:${"0".repeat(
                64
              )}`
            }
          }
        ]
      }),
      "SKETCH_EDIT_SOURCE_REVISION_STALE"
    );
    expect(stale.error.path).toContain("expectedSourceRevision");

    const fresh = readiness(engine, {
      kind: "split",
      sketchId: "sketch_1",
      entityId: "target",
      splitPoints: [[5, 0]]
    });
    if (fresh.preparedOperation.op !== "sketch.split") {
      throw new Error("Expected prepared split.");
    }
    const solverStale = expectBatchError(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            ...fresh.preparedOperation,
            precondition: {
              ...fresh.preparedOperation.precondition,
              expectedSolverEvaluationIdentity: `partbench-sketch-solver-evaluation-v1:${"0".repeat(
                64
              )}`
            }
          }
        ]
      }),
      "SKETCH_EDIT_SOLVER_STATE_BLOCKED"
    );
    expect(solverStale.error.path).toContain(
      "expectedSolverEvaluationIdentity"
    );
    expect(
      readiness(engine, {
        kind: "split",
        sketchId: "sketch_1",
        entityId: "target",
        splitPoints: [[5, 0]]
      }).preparedOperation
    ).toEqual(fresh.preparedOperation);
  });

  it("preserves history-sensitive source identity through the command worker", async () => {
    const engine = lineEngine();
    const ready = readiness(engine, {
      kind: "split",
      sketchId: "sketch_1",
      entityId: "target",
      splitPoints: [[5, 0]]
    });
    const executor = new AsyncCadCommandExecutor(
      engine,
      new SnapshotCadCommandWorker()
    );

    const dryRun = await executor.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [ready.preparedOperation]
    });
    expect(dryRun.ok).toBe(true);
    expect(engine.getTransactions()).toHaveLength(1);

    const committed = await executor.executeBatch({
      version: "cadops.v1",
      mode: "commit",
      ops: [ready.preparedOperation]
    });
    expect(committed.ok).toBe(true);
    expect(engine.getTransactions()).toHaveLength(2);
  });

  it("rejects caller output IDs that already exist in another sketch", () => {
    const engine = lineEngine();
    engine.applyBatch([
      {
        op: "sketch.create",
        id: "sketch_2",
        name: "Other",
        plane: "XY"
      },
      {
        op: "sketch.addPoint",
        sketchId: "sketch_2",
        id: "foreign_output",
        point: [0, 0]
      }
    ]);
    const ready = readiness(engine, {
      kind: "split",
      sketchId: "sketch_1",
      entityId: "target",
      splitPoints: [[5, 0]]
    });
    if (ready.preparedOperation.op !== "sketch.split") {
      throw new Error("Expected prepared split.");
    }
    const before = engine.getDocument();

    const failed = expectBatchError(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            ...ready.preparedOperation,
            createdEntityIds: ["foreign_output"]
          }
        ]
      }),
      "INVALID_OPERATION"
    );
    expect(failed.error.sketchEntityId).toBe("foreign_output");
    expect(engine.getDocument()).toEqual(before);
  });

  it("returns complete impact for duplicate deletion lists without mutation", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Edit", plane: "XY" },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "target",
        start: [0, 0],
        end: [6, 0]
      },
      {
        op: "sketch.dimension.create",
        id: "length_dimension",
        name: "Length",
        sketchId: "sketch_1",
        entityId: "target",
        target: { entityKind: "line", role: "length" },
        value: 6
      }
    ]);
    const ready = readiness(engine, {
      kind: "split",
      sketchId: "sketch_1",
      entityId: "target",
      splitPoints: [[3, 0]]
    });
    if (ready.preparedOperation.op !== "sketch.split") {
      throw new Error("Expected prepared split.");
    }
    expect(ready.impact.requiredDeleteDimensionIds).toEqual([
      "length_dimension"
    ]);
    const before = engine.getDocument();
    const failed = expectBatchError(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "commit",
        ops: [
          {
            ...ready.preparedOperation,
            deleteDimensionIds: ["length_dimension", "length_dimension"]
          }
        ]
      }),
      "SKETCH_EDIT_DELETE_LIST_MISMATCH"
    );
    expect(failed.error.curveEditImpact).toEqual(ready.impact);
    expect(engine.getDocument()).toEqual(before);

    const committed = engine.apply(ready.preparedOperation);
    expect(
      committed.transaction.diff.sketches?.curveEdits?.[0]?.deletedDimensionIds
    ).toEqual(["length_dimension"]);
    expect(importCadProject(exportCadProject(engine)).getDocument()).toEqual(
      engine.getDocument()
    );
  });

  it("blocks deletion-producing edits on feature inputs", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Edit", plane: "XY" },
      {
        op: "sketch.addRectangle",
        sketchId: "sketch_1",
        id: "profile",
        center: [0, 0],
        width: 4,
        height: 2
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "probe",
        start: [0, 4],
        end: [4, 4]
      },
      {
        op: "feature.extrude",
        id: "feature_1",
        bodyId: "body_1",
        sketchId: "sketch_1",
        entityId: "profile",
        depth: 2
      },
      {
        op: "feature.extrude",
        id: "feature_2",
        bodyId: "body_2",
        sketchId: "sketch_1",
        entityId: "profile",
        depth: 3
      }
    ]);
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.curveEditReadiness",
        proposal: {
          kind: "explodeRectangle",
          sketchId: "sketch_1",
          entityId: "profile"
        }
      }
    });
    expect(response).toMatchObject({
      ok: true,
      query: "sketch.curveEditReadiness",
      status: "blocked",
      diagnostics: [
        {
          code: "SKETCH_EDIT_DEPENDENCY_CONFLICT",
          featureId: "feature_1"
        },
        {
          code: "SKETCH_EDIT_DEPENDENCY_CONFLICT",
          featureId: "feature_2"
        }
      ]
    });

    const probe = readiness(engine, {
      kind: "split",
      sketchId: "sketch_1",
      entityId: "probe",
      splitPoints: [[2, 4]]
    });
    expectBatchError(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          {
            op: "sketch.explodeRectangle",
            sketchId: "sketch_1",
            precondition: probe.preparedOperation.precondition,
            entityId: "profile",
            lineEntityIds: [
              "exploded_1",
              "exploded_2",
              "exploded_3",
              "exploded_4"
            ],
            deleteConstraintIds: [],
            deleteDimensionIds: []
          }
        ]
      }),
      "SKETCH_ENTITY_IN_USE"
    );
  });

  it("rejects mixed curve-edit batches before any precondition check", () => {
    const engine = lineEngine();
    const ready = readiness(engine, {
      kind: "split",
      sketchId: "sketch_1",
      entityId: "target",
      splitPoints: [[5, 0]]
    });
    const operation: PreparedSketchCurveEditOp = {
      ...ready.preparedOperation,
      precondition: {
        expectedSourceRevision: "stale",
        expectedSolverEvaluationIdentity: "stale"
      }
    };
    expectBatchError(
      engine.executeBatch({
        version: "cadops.v1",
        mode: "dryRun",
        ops: [
          operation,
          {
            op: "scene.createBox",
            dimensions: { width: 1, height: 1, depth: 1 }
          }
        ]
      }),
      "SKETCH_EDIT_BATCH_MULTIPLE_UNSUPPORTED"
    );
  });
});
