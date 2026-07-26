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

  it("previews every finite line-trim intersection in source order without changing replay evidence", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Edit", plane: "XY" },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "target",
        start: [0, 0],
        end: [12, 0]
      },
      ...[
        ["boundary_9", 9],
        ["boundary_2", 2],
        ["boundary_5", 5]
      ].map(([id, x]) => ({
        op: "sketch.addLine" as const,
        sketchId: "sketch_1",
        id: id as string,
        start: [x as number, -2] as const,
        end: [x as number, 2] as const
      }))
    ]);
    const ready = readiness(engine, {
      kind: "trim",
      sketchId: "sketch_1",
      entityId: "target",
      boundaryEntityIds: ["boundary_9", "boundary_2", "boundary_5"],
      pickPoint: [7, 0]
    });

    expect(ready.preview.intersections).toEqual([
      { boundaryEntityId: "boundary_2", point: [2, 0], targetParameter: 2 },
      { boundaryEntityId: "boundary_5", point: [5, 0], targetParameter: 5 },
      { boundaryEntityId: "boundary_9", point: [9, 0], targetParameter: 9 }
    ]);
    const dryRun = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [ready.preparedOperation]
    });
    expect(dryRun.ok).toBe(true);
    if (!dryRun.ok) return;
    const committed = engine.apply(ready.preparedOperation);
    expect(committed.transaction.diff).toEqual(dryRun.semanticDiff);
    expect(
      committed.transaction.diff.sketches?.curveEdits?.[0]
    ).not.toHaveProperty("previewIntersections");
    const committedDocument = engine.getDocument();
    engine.undo();
    engine.redo();
    expect(engine.getDocument()).toEqual(committedDocument);
  });

  it("previews every finite signed-arc trim intersection in authored traversal order", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Edit", plane: "XY" },
      {
        op: "sketch.addArc",
        sketchId: "sketch_1",
        id: "target",
        definition: {
          kind: "centerAngles",
          center: [0, 0],
          radius: 10,
          startAngleDegrees: 0,
          sweepAngleDegrees: 180
        }
      },
      ...[
        ["boundary_120", -5],
        ["boundary_60", 5],
        ["boundary_90", 0]
      ].map(([id, x]) => ({
        op: "sketch.addLine" as const,
        sketchId: "sketch_1",
        id: id as string,
        start: [x as number, 0] as const,
        end: [x as number, 12] as const
      }))
    ]);
    const ready = readiness(engine, {
      kind: "trim",
      sketchId: "sketch_1",
      entityId: "target",
      boundaryEntityIds: ["boundary_120", "boundary_60", "boundary_90"],
      pickPoint: [
        Math.cos((75 * Math.PI) / 180) * 10,
        Math.sin((75 * Math.PI) / 180) * 10
      ]
    });

    expect(
      ready.preview.intersections.map(
        ({ boundaryEntityId, targetParameter }) => ({
          boundaryEntityId,
          targetParameter
        })
      )
    ).toEqual([
      { boundaryEntityId: "boundary_60", targetParameter: 60 },
      { boundaryEntityId: "boundary_90", targetParameter: 90 },
      { boundaryEntityId: "boundary_120", targetParameter: 120 }
    ]);
    for (const intersection of ready.preview.intersections) {
      expect(Math.hypot(...intersection.point)).toBeCloseTo(10, 12);
    }
  });

  it("previews all circle-trim partitions, including intersections outside the retained arc", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Edit", plane: "XY" },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "target",
        center: [0, 0],
        radius: 10
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "vertical",
        start: [0, -12],
        end: [0, 12]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "horizontal",
        start: [-12, 0],
        end: [12, 0]
      }
    ]);
    const ready = readiness(engine, {
      kind: "trim",
      sketchId: "sketch_1",
      entityId: "target",
      boundaryEntityIds: ["vertical", "horizontal"],
      pickPoint: [Math.SQRT1_2 * 10, Math.SQRT1_2 * 10]
    });

    expect(
      ready.preview.intersections.map(
        ({ boundaryEntityId, targetParameter }) => ({
          boundaryEntityId,
          targetParameter
        })
      )
    ).toEqual([
      { boundaryEntityId: "horizontal", targetParameter: 0 },
      { boundaryEntityId: "vertical", targetParameter: 90 },
      { boundaryEntityId: "horizontal", targetParameter: 180 },
      { boundaryEntityId: "vertical", targetParameter: 270 }
    ]);
    expect(ready.preview.resultEntityCount).toBe(1);
    expect(ready.preview.resultEntities[0]).toMatchObject({
      kind: "arc",
      startAngleDegrees: 90,
      sweepAngleDegrees: 270
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

  it("previews the nearest selectable hit per extend boundary while applying the global nearest", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Edit", plane: "XY" },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "target",
        start: [0, 0],
        end: [2, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "far",
        start: [7, -2],
        end: [7, 2]
      },
      {
        op: "sketch.addCircle",
        sketchId: "sketch_1",
        id: "near-ring",
        center: [4, 0],
        radius: 1
      }
    ]);
    const ready = readiness(engine, {
      kind: "extend",
      sketchId: "sketch_1",
      entityId: "target",
      endpoint: "end",
      boundaryEntityIds: ["far", "near-ring"]
    });

    expect(ready.preview.intersections).toEqual([
      {
        boundaryEntityId: "near-ring",
        point: [3, 0],
        targetParameter: 3
      },
      { boundaryEntityId: "far", point: [7, 0], targetParameter: 7 }
    ]);
    expect(ready.preview.resultEntities).toEqual([
      {
        id: "target",
        kind: "line",
        start: [0, 0],
        end: [3, 0],
        construction: false
      }
    ]);
    engine.apply(ready.preparedOperation);
    expect(
      engine.getDocument().sketches.get("sketch_1")?.entities.get("target")
    ).toMatchObject({ kind: "line", start: [0, 0], end: [3, 0] });
  });

  it("returns complete trim evidence when every fixed witness is an intersection", () => {
    const engine = new CadEngine();
    const witnessXs = [
      ["boundary_low", 10 * 0.21132486540518713],
      ["boundary_mid", 5],
      ["boundary_high", 10 * 0.7886751345948129]
    ] as const;
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Edit", plane: "XY" },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "target",
        start: [0, 0],
        end: [10, 0]
      },
      ...witnessXs.map(([id, x]) => ({
        op: "sketch.addLine" as const,
        sketchId: "sketch_1",
        id,
        start: [x, -2] as const,
        end: [x, 2] as const
      }))
    ]);
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.curveEditReadiness",
        proposal: {
          kind: "trim",
          sketchId: "sketch_1",
          entityId: "target",
          boundaryEntityIds: ["boundary_high", "boundary_low", "boundary_mid"],
          pickPoint: [5, 0]
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      query: "sketch.curveEditReadiness",
      status: "blocked",
      diagnostics: [{ code: "SKETCH_EDIT_INTERSECTION_AMBIGUOUS" }],
      preview: {
        intersections: [
          {
            boundaryEntityId: "boundary_low",
            point: [witnessXs[0][1], 0],
            targetParameter: witnessXs[0][1]
          },
          {
            boundaryEntityId: "boundary_mid",
            point: [5, 0],
            targetParameter: 5
          },
          {
            boundaryEntityId: "boundary_high",
            point: [witnessXs[2][1], 0],
            targetParameter: witnessXs[2][1]
          }
        ],
        projectedSplitParameters: [],
        resultEntityCount: 0,
        resultEntities: []
      }
    });
  });

  it("returns command-selectable per-boundary evidence for tied nearest extensions", () => {
    const engine = new CadEngine();
    engine.applyBatch([
      { op: "sketch.create", id: "sketch_1", name: "Edit", plane: "XY" },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "target",
        start: [0, 0],
        end: [2, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "boundary_z",
        start: [5, -2],
        end: [5, 2]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "boundary_a",
        start: [5, -3],
        end: [5, 3]
      }
    ]);
    const response = engine.executeQuery({
      version: "cadops.v1",
      query: {
        query: "sketch.curveEditReadiness",
        proposal: {
          kind: "extend",
          sketchId: "sketch_1",
          entityId: "target",
          endpoint: "end",
          boundaryEntityIds: ["boundary_z", "boundary_a"]
        }
      }
    });

    expect(response).toMatchObject({
      ok: true,
      query: "sketch.curveEditReadiness",
      status: "blocked",
      diagnostics: [{ code: "SKETCH_EDIT_INTERSECTION_AMBIGUOUS" }],
      preview: {
        intersections: [
          {
            boundaryEntityId: "boundary_a",
            point: [5, 0],
            targetParameter: 5
          },
          {
            boundaryEntityId: "boundary_z",
            point: [5, 0],
            targetParameter: 5
          }
        ],
        projectedSplitParameters: [],
        resultEntityCount: 0,
        resultEntities: []
      }
    });
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
