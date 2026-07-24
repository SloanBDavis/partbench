import { describe, expect, it } from "vitest";
import type {
  PreparedSketchCurveEditOp,
  SketchExplodeRectangleOp,
  SketchSplitOp
} from "@web-cad/cad-protocol";
import {
  CadEngine,
  CadProjectImportError,
  exportCadProject,
  importCadProject,
  type CadProject
} from "./index";

type PreparedSplitOp = Extract<
  PreparedSketchCurveEditOp,
  { readonly op: "sketch.split" }
>;
type PreparedExplodeRectangleOp = Extract<
  PreparedSketchCurveEditOp,
  { readonly op: "sketch.explodeRectangle" }
>;

function createLineEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
    {
      op: "sketch.addLine",
      sketchId: "sketch_1",
      id: "line_1",
      start: [0, 0],
      end: [6, 0]
    }
  ]);
  return engine;
}

function createRectangleEngine(): CadEngine {
  const engine = new CadEngine();
  engine.applyBatch([
    { op: "sketch.create", id: "sketch_1", name: "Profile", plane: "XY" },
    {
      op: "sketch.addRectangle",
      sketchId: "sketch_1",
      id: "rectangle_1",
      center: [0, 0],
      width: 8,
      height: 4
    }
  ]);
  return engine;
}

function prepareSplit(engine: CadEngine): PreparedSplitOp {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "sketch.curveEditReadiness",
      proposal: {
        kind: "split",
        sketchId: "sketch_1",
        entityId: "line_1",
        splitPoints: [
          [2, 0],
          [4, 0]
        ]
      }
    }
  });

  if (
    !response.ok ||
    response.query !== "sketch.curveEditReadiness" ||
    response.status !== "ready" ||
    response.preparedOperation.op !== "sketch.split"
  ) {
    throw new Error(
      `Expected ready split operation: ${JSON.stringify(response)}`
    );
  }

  return response.preparedOperation;
}

function prepareExplodeRectangle(
  engine: CadEngine
): PreparedExplodeRectangleOp {
  const response = engine.executeQuery({
    version: "cadops.v1",
    query: {
      query: "sketch.curveEditReadiness",
      proposal: {
        kind: "explodeRectangle",
        sketchId: "sketch_1",
        entityId: "rectangle_1"
      }
    }
  });

  if (
    !response.ok ||
    response.query !== "sketch.curveEditReadiness" ||
    response.status !== "ready" ||
    response.preparedOperation.op !== "sketch.explodeRectangle"
  ) {
    throw new Error(
      `Expected ready rectangle-explosion operation: ${JSON.stringify(
        response
      )}`
    );
  }

  return response.preparedOperation;
}

function omitSplitGeneratedIds(prepared: PreparedSplitOp): SketchSplitOp {
  return {
    op: prepared.op,
    sketchId: prepared.sketchId,
    precondition: prepared.precondition,
    entityId: prepared.entityId,
    splitPoints: prepared.splitPoints
  };
}

function omitExplodeGeneratedIds(
  prepared: PreparedExplodeRectangleOp
): SketchExplodeRectangleOp {
  return {
    op: prepared.op,
    sketchId: prepared.sketchId,
    precondition: prepared.precondition,
    entityId: prepared.entityId
  };
}

function expectProjectHistoryError(
  action: () => unknown,
  path: "$.history" | "$.redoStack"
): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(CadProjectImportError);
    expect((error as CadProjectImportError).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_TRANSACTION_HISTORY",
          path
        })
      ])
    );
    return;
  }

  throw new Error("Expected curve-edit history replay to be rejected.");
}

function replaceLastHistoryOperation(
  project: CadProject,
  operation: SketchSplitOp | SketchExplodeRectangleOp
): CadProject {
  const transaction = project.history.at(-1);
  if (!transaction) {
    throw new Error("Expected committed curve-edit transaction.");
  }

  return {
    ...project,
    history: [
      ...project.history.slice(0, -1),
      { ...transaction, ops: [operation] }
    ]
  };
}

function replaceFirstRedoOperation(
  project: CadProject,
  operation: SketchSplitOp | SketchExplodeRectangleOp
): CadProject {
  const transaction = project.redoStack[0];
  if (!transaction) {
    throw new Error("Expected undone curve-edit transaction.");
  }

  return {
    ...project,
    redoStack: [{ ...transaction, ops: [operation] }]
  };
}

describe("V19 curve-edit persistence", () => {
  it("materializes every omitted split and rectangle-explosion output ID in committed history", () => {
    const splitEngine = createLineEngine();
    const preparedSplit = prepareSplit(splitEngine);

    expect(preparedSplit.createdEntityIds).toHaveLength(2);
    expect(preparedSplit.deleteConstraintIds).toEqual([]);
    expect(preparedSplit.deleteDimensionIds).toEqual([]);

    splitEngine.apply(omitSplitGeneratedIds(preparedSplit));

    const storedSplit = splitEngine.getTransactions().at(-1)?.ops[0];
    expect(storedSplit?.op).toBe("sketch.split");
    if (storedSplit?.op !== "sketch.split") {
      throw new Error("Expected stored split operation.");
    }
    expect(storedSplit.createdEntityIds).toEqual(
      preparedSplit.createdEntityIds
    );
    expect(storedSplit.deleteConstraintIds).toEqual(
      preparedSplit.deleteConstraintIds
    );
    expect(storedSplit.deleteDimensionIds).toEqual(
      preparedSplit.deleteDimensionIds
    );

    const rectangleEngine = createRectangleEngine();
    const preparedExplode = prepareExplodeRectangle(rectangleEngine);

    expect(preparedExplode.lineEntityIds).toHaveLength(4);
    expect(new Set(preparedExplode.lineEntityIds).size).toBe(4);
    expect(preparedExplode.deleteConstraintIds).toEqual([]);
    expect(preparedExplode.deleteDimensionIds).toEqual([]);

    rectangleEngine.apply(omitExplodeGeneratedIds(preparedExplode));

    const storedExplode = rectangleEngine.getTransactions().at(-1)?.ops[0];
    expect(storedExplode?.op).toBe("sketch.explodeRectangle");
    if (storedExplode?.op !== "sketch.explodeRectangle") {
      throw new Error("Expected stored rectangle-explosion operation.");
    }
    expect(storedExplode.lineEntityIds).toEqual(preparedExplode.lineEntityIds);
    expect(storedExplode.deleteConstraintIds).toEqual(
      preparedExplode.deleteConstraintIds
    );
    expect(storedExplode.deleteDimensionIds).toEqual(
      preparedExplode.deleteDimensionIds
    );
  });

  it("does not consume prospective entity IDs during a dry-run", () => {
    const engine = createLineEngine();
    const before = engine.getDocument();
    const beforeTransactionCount = engine.getTransactions().length;
    const firstPrepared = prepareSplit(engine);
    const directOperation = omitSplitGeneratedIds(firstPrepared);

    const dryRun = engine.executeBatch({
      version: "cadops.v1",
      mode: "dryRun",
      ops: [directOperation]
    });

    expect(dryRun.ok).toBe(true);
    expect(engine.getDocument()).toEqual(before);
    expect(engine.getTransactions()).toHaveLength(beforeTransactionCount);

    const secondPrepared = prepareSplit(engine);
    expect(secondPrepared.createdEntityIds).toEqual(
      firstPrepared.createdEntityIds
    );

    engine.apply(directOperation);
    const stored = engine.getTransactions().at(-1)?.ops[0];
    expect(stored?.op).toBe("sketch.split");
    if (stored?.op !== "sketch.split") {
      throw new Error("Expected stored split operation.");
    }
    expect(stored.createdEntityIds).toEqual(firstPrepared.createdEntityIds);
  });

  it("preserves materialized IDs through export, canonical replay, undo, and redo", () => {
    const engine = createRectangleEngine();
    const prepared = prepareExplodeRectangle(engine);
    engine.apply(omitExplodeGeneratedIds(prepared));

    const afterCommit = engine.getDocument();
    const exported = exportCadProject(engine);
    const restored = importCadProject(exported);
    const restoredOperation = restored.getTransactions().at(-1)?.ops[0];

    expect(restoredOperation?.op).toBe("sketch.explodeRectangle");
    if (restoredOperation?.op !== "sketch.explodeRectangle") {
      throw new Error("Expected restored rectangle-explosion operation.");
    }
    expect(restoredOperation.lineEntityIds).toEqual(prepared.lineEntityIds);
    expect(restored.getDocument()).toEqual(afterCommit);

    const undone = restored.undo();
    expect(undone?.transaction.status).toBe("undone");
    expect([
      ...(restored.getDocument().sketches.get("sketch_1")?.entities.keys() ??
        [])
    ]).toEqual(["rectangle_1"]);

    const redone = restored.redo();
    expect(redone?.transaction.status).toBe("committed");
    expect(redone?.transaction.ops[0]).toEqual(restoredOperation);
    expect(restored.getDocument()).toEqual(afterCommit);
  });

  it("rejects imported committed history that omits required split output IDs", () => {
    const engine = createLineEngine();
    const prepared = prepareSplit(engine);
    const operationWithoutIds = omitSplitGeneratedIds(prepared);
    engine.apply(operationWithoutIds);

    const malformed = replaceLastHistoryOperation(
      exportCadProject(engine),
      operationWithoutIds
    );

    expectProjectHistoryError(() => importCadProject(malformed), "$.history");
  });

  it("rejects imported redo replay that omits required rectangle output IDs", () => {
    const engine = createRectangleEngine();
    const prepared = prepareExplodeRectangle(engine);
    const operationWithoutIds = omitExplodeGeneratedIds(prepared);
    engine.apply(operationWithoutIds);
    engine.undo();

    const malformed = replaceFirstRedoOperation(
      exportCadProject(engine),
      operationWithoutIds
    );

    expectProjectHistoryError(() => importCadProject(malformed), "$.redoStack");
  });
});
