import { isDeepStrictEqual } from "node:util";

export const V19_CURVE_EDIT_WORKFLOW_VERSION =
  "partbench.v19-curve-edit-workflow.v1";

const CADOPS_VERSION = "cadops.v1";

class V19CurveEditWorkflowFailure extends Error {}

export function runV19CurveEditWorkflow(cadCore) {
  const checks = [];
  const failures = [];
  let summary = {};

  function check(id, condition, evidence) {
    const passed = condition === true;
    checks.push({ id, passed, evidence });
    if (!passed) {
      throw new V19CurveEditWorkflowFailure(`V19 check failed: ${id}`);
    }
  }

  try {
    const engine = createWorkflowEngine(cadCore);
    const initialProject = cadCore.exportCadProject(engine);
    const initialSourceIdentity =
      cadCore.createCadProjectSourceIdentity(initialProject);
    const trimReady = readyCurveEdit(engine, {
      kind: "trim",
      sketchId: "sketch_1",
      entityId: "trim_target",
      boundaryEntityIds: ["trim_boundary_a", "trim_boundary_b"],
      pickPoint: [5, 0]
    });

    check(
      "readiness",
      trimReady.preparedOperation.op === "sketch.trim" &&
        trimReady.preview.resultEntityCount === 2 &&
        trimReady.preview.intersections.length === 2 &&
        trimReady.diagnostics.length === 0,
      {
        operation: trimReady.preparedOperation.op,
        resultEntityCount: trimReady.preview.resultEntityCount,
        intersections: trimReady.preview.intersections
      }
    );

    const lengthImpact = trimReady.impact.dimensionImpacts.find(
      (impact) => impact.id === "trim_length"
    );
    const horizontalImpact = trimReady.impact.constraintImpacts.find(
      (impact) => impact.id === "trim_horizontal"
    );
    check(
      "constrained-trim-consequence",
      isDeepStrictEqual(trimReady.impact.requiredDeleteDimensionIds, [
        "trim_length"
      ]) &&
        trimReady.impact.requiredDeleteConstraintIds.length === 0 &&
        lengthImpact?.disposition === "invalid" &&
        Number.isFinite(lengthImpact.residual) &&
        horizontalImpact?.disposition === "preserved" &&
        horizontalImpact.residual === 0,
      {
        requiredDeleteConstraintIds:
          trimReady.impact.requiredDeleteConstraintIds,
        requiredDeleteDimensionIds: trimReady.impact.requiredDeleteDimensionIds,
        lengthImpact,
        horizontalImpact
      }
    );

    const beforeRejectedEdit = cadCore.exportCadProjectJson(engine);
    const beforeRejectedHistoryCount = engine.getTransactions().length;
    const rejected = engine.executeBatch({
      version: CADOPS_VERSION,
      mode: "commit",
      ops: [
        {
          ...trimReady.preparedOperation,
          deleteDimensionIds: []
        }
      ]
    });
    check(
      "incomplete-delete-list-rejected-with-impact",
      rejected.ok === false &&
        rejected.error.code === "SKETCH_EDIT_DELETE_LIST_MISMATCH" &&
        isDeepStrictEqual(rejected.error.curveEditImpact, trimReady.impact) &&
        cadCore.exportCadProjectJson(engine) === beforeRejectedEdit &&
        engine.getTransactions().length === beforeRejectedHistoryCount,
      rejected.ok
        ? { ok: true }
        : {
            code: rejected.error.code,
            curveEditImpact: rejected.error.curveEditImpact
          }
    );

    const trimOperation = omitTrimCreatedEntityIds(trimReady.preparedOperation);
    const trimCommit = engine.executeBatch({
      version: CADOPS_VERSION,
      mode: "commit",
      ops: [trimOperation]
    });
    check(
      "explicit-commit",
      trimCommit.ok === true &&
        engine
          .getDocument()
          .sketches.get("sketch_1")
          ?.entities.has("trim_target") === true &&
        trimReady.preparedOperation.createdEntityIds.every(
          (entityId) =>
            engine
              .getDocument()
              .sketches.get("sketch_1")
              ?.entities.has(entityId) === true
        ),
      trimCommit
    );

    const trimTransaction = engine.getTransactions().at(-1);
    const storedTrimOperation = trimTransaction?.ops[0];
    const trimSemanticEvidence =
      trimTransaction?.diff.sketches?.curveEdits?.[0];
    check(
      "replacement-evidence",
      trimReady.impact.replacements.length === 1 &&
        trimReady.impact.replacements[0]?.sourceEntityId === "trim_target" &&
        trimReady.impact.replacements[0]?.disposition === "modified" &&
        isDeepStrictEqual(
          trimSemanticEvidence?.replacements,
          trimReady.impact.replacements
        ),
      {
        readiness: trimReady.impact.replacements,
        semanticDiff: trimSemanticEvidence?.replacements
      }
    );

    check(
      "materialized-history",
      storedTrimOperation?.op === "sketch.trim" &&
        isDeepStrictEqual(
          storedTrimOperation.createdEntityIds,
          trimReady.preparedOperation.createdEntityIds
        ) &&
        isDeepStrictEqual(
          storedTrimOperation.deleteConstraintIds,
          trimReady.preparedOperation.deleteConstraintIds
        ) &&
        isDeepStrictEqual(
          storedTrimOperation.deleteDimensionIds,
          trimReady.preparedOperation.deleteDimensionIds
        ),
      storedTrimOperation
    );

    const afterTrimDocument = engine.getDocument();
    const afterTrimProject = cadCore.exportCadProject(engine);
    const afterTrimSourceIdentity =
      cadCore.createCadProjectSourceIdentity(afterTrimProject);
    const extendReady = readyCurveEdit(engine, {
      kind: "extend",
      sketchId: "sketch_1",
      entityId: "extend_target",
      endpoint: "end",
      boundaryEntityIds: ["extend_boundary"]
    });
    const extendIntersection = extendReady.preview.intersections[0];
    const extendCommit = engine.executeBatch({
      version: CADOPS_VERSION,
      mode: "commit",
      ops: [extendReady.preparedOperation]
    });
    const extendedTarget = engine
      .getDocument()
      .sketches.get("sketch_1")
      ?.entities.get("extend_target");
    check(
      "finite-boundary-extend",
      extendReady.preparedOperation.op === "sketch.extend" &&
        extendReady.preview.intersections.length === 1 &&
        extendIntersection?.boundaryEntityId === "extend_boundary" &&
        extendIntersection.point.every(Number.isFinite) &&
        Number.isFinite(extendIntersection.targetParameter) &&
        isDeepStrictEqual(extendIntersection.point, [5, 4]) &&
        extendCommit.ok === true &&
        extendedTarget?.kind === "line" &&
        isDeepStrictEqual(extendedTarget.end, [5, 4]),
      {
        intersection: extendIntersection,
        extendedTarget
      }
    );

    const afterExtendDocument = engine.getDocument();
    const afterExtendSourceIdentity = cadCore.createCadProjectSourceIdentity(
      cadCore.exportCadProject(engine)
    );
    const undo = engine.undo();
    const documentAfterUndo = engine.getDocument();
    const redo = engine.redo();
    const documentAfterRedo = engine.getDocument();
    check(
      "single-step-undo-redo",
      undo?.transaction.ops[0]?.op === "sketch.extend" &&
        undo.transaction.status === "undone" &&
        isDeepStrictEqual(documentAfterUndo, afterTrimDocument) &&
        redo?.transaction.ops[0]?.op === "sketch.extend" &&
        redo.transaction.status === "committed" &&
        isDeepStrictEqual(documentAfterRedo, afterExtendDocument),
      {
        undoStatus: undo?.transaction.status,
        redoStatus: redo?.transaction.status
      }
    );

    const sourceRevisionPrefix = `${initialSourceIdentity.algorithm}:`;
    const redoneSourceIdentity = cadCore.createCadProjectSourceIdentity(
      cadCore.exportCadProject(engine)
    );
    check(
      "source-identity",
      trimReady.preparedOperation.precondition.expectedSourceRevision ===
        `${sourceRevisionPrefix}${initialSourceIdentity.sha256}` &&
        extendReady.preparedOperation.precondition.expectedSourceRevision ===
          `${afterTrimSourceIdentity.algorithm}:${afterTrimSourceIdentity.sha256}` &&
        initialSourceIdentity.sha256 !== afterTrimSourceIdentity.sha256 &&
        afterTrimSourceIdentity.sha256 !== afterExtendSourceIdentity.sha256 &&
        isDeepStrictEqual(redoneSourceIdentity, afterExtendSourceIdentity),
      {
        initial: initialSourceIdentity,
        afterTrim: afterTrimSourceIdentity,
        afterExtend: afterExtendSourceIdentity,
        afterRedo: redoneSourceIdentity
      }
    );

    const finalProject = cadCore.exportCadProject(engine);
    const finalJson = cadCore.exportCadProjectJson(engine);
    const restored = cadCore.importCadProjectJson(finalJson);
    const restoredProject = cadCore.exportCadProject(restored);
    const restoredJson = cadCore.exportCadProjectJson(restored);
    const restoredTrimOperation = restored
      .getTransactions()
      .find((transaction) => transaction.ops[0]?.op === "sketch.trim")?.ops[0];
    check(
      "json-round-trip",
      isDeepStrictEqual(restoredProject, finalProject) &&
        restoredJson === finalJson &&
        isDeepStrictEqual(
          cadCore.createCadProjectSourceIdentity(restoredProject),
          afterExtendSourceIdentity
        ) &&
        restoredTrimOperation?.op === "sketch.trim" &&
        isDeepStrictEqual(
          restoredTrimOperation.createdEntityIds,
          trimReady.preparedOperation.createdEntityIds
        ),
      {
        schemaVersion: restoredProject.schemaVersion,
        jsonBytes: Buffer.byteLength(finalJson),
        restoredTrimOperation
      }
    );

    summary = {
      sketchId: "sketch_1",
      trimCreatedEntityIds: trimReady.preparedOperation.createdEntityIds,
      deletedDimensionIds: trimReady.impact.requiredDeleteDimensionIds,
      extendIntersection,
      transactionCount: engine.getTransactions().length,
      schemaVersion: finalProject.schemaVersion,
      sourceIdentity: afterExtendSourceIdentity,
      jsonBytes: Buffer.byteLength(finalJson)
    };
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }

  return {
    version: V19_CURVE_EDIT_WORKFLOW_VERSION,
    ok: failures.length === 0 && checks.every((check) => check.passed),
    checkCount: checks.length,
    passedCount: checks.filter((check) => check.passed).length,
    checks,
    failures,
    summary
  };
}

export function formatV19CurveEditWorkflowSummary(result) {
  const headline = result.ok
    ? "V19 curve-edit workflow smoke passed"
    : "V19 curve-edit workflow smoke failed";
  const lines = [
    `${headline}: ${result.passedCount}/${result.checkCount} checks passed.`
  ];

  for (const check of result.checks) {
    lines.push(`- ${check.passed ? "pass" : "fail"} ${check.id}`);
  }
  for (const failure of result.failures) {
    lines.push(`- error ${failure}`);
  }
  if (result.ok) {
    lines.push(
      `- source ${result.summary.sourceIdentity.algorithm}:${result.summary.sourceIdentity.sha256}`
    );
  }

  return lines.join("\n");
}

function createWorkflowEngine(cadCore) {
  const engine = new cadCore.CadEngine();
  const response = engine.executeBatch({
    version: CADOPS_VERSION,
    mode: "commit",
    ops: [
      {
        op: "sketch.create",
        id: "sketch_1",
        name: "V19 curve edits",
        plane: "XY"
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "trim_target",
        start: [0, 0],
        end: [10, 0]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "trim_boundary_a",
        start: [3, -2],
        end: [3, 2]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "trim_boundary_b",
        start: [7, -2],
        end: [7, 2]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "extend_target",
        start: [0, 4],
        end: [2, 4]
      },
      {
        op: "sketch.addLine",
        sketchId: "sketch_1",
        id: "extend_boundary",
        start: [5, 3],
        end: [5, 5]
      },
      {
        op: "sketch.constraint.create",
        id: "trim_horizontal",
        name: "Trim target horizontal",
        sketchId: "sketch_1",
        entityId: "trim_target",
        kind: "horizontal"
      },
      {
        op: "sketch.dimension.create",
        id: "trim_length",
        name: "Trim target length",
        sketchId: "sketch_1",
        entityId: "trim_target",
        target: { entityKind: "line", role: "length" },
        value: 10
      }
    ]
  });
  if (!response.ok) {
    throw new Error(`V19 fixture setup failed: ${JSON.stringify(response)}`);
  }
  return engine;
}

function readyCurveEdit(engine, proposal) {
  const response = engine.executeQuery({
    version: CADOPS_VERSION,
    query: { query: "sketch.curveEditReadiness", proposal }
  });
  if (
    !response.ok ||
    response.query !== "sketch.curveEditReadiness" ||
    response.status !== "ready"
  ) {
    throw new Error(
      `V19 curve-edit readiness failed: ${JSON.stringify(response)}`
    );
  }
  return response;
}

function omitTrimCreatedEntityIds(prepared) {
  if (prepared.op !== "sketch.trim") {
    throw new Error(`Expected prepared trim, received ${prepared.op}.`);
  }
  return {
    op: prepared.op,
    sketchId: prepared.sketchId,
    precondition: prepared.precondition,
    entityId: prepared.entityId,
    boundaryEntityIds: prepared.boundaryEntityIds,
    pickPoint: prepared.pickPoint,
    deleteConstraintIds: prepared.deleteConstraintIds,
    deleteDimensionIds: prepared.deleteDimensionIds
  };
}
