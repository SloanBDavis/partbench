import type {
  CadOp,
  CadQueryResponse,
  PreparedSketchCurveEditOp,
  SketchCurveEditProposal
} from "@web-cad/cad-protocol";
import { describe, expect, it, vi } from "vitest";
import {
  querySketchCurveEditReadiness,
  submitPreparedSketchCurveEdit
} from "./sketchCurveEditWorkflow";

const SOURCE_REVISION = `partbench-source-v1:${"a".repeat(64)}`;

describe("V19 production Sketch Modify command boundary", () => {
  it("sends the authored proposal to the authoritative readiness query", () => {
    const proposal: SketchCurveEditProposal = {
      kind: "extend",
      sketchId: "sketch-a",
      entityId: "line-a",
      endpoint: "end",
      boundaryEntityIds: ["line-boundary"]
    };
    const response: CadQueryResponse = {
      ok: true,
      query: "sketch.curveEditReadiness",
      cadOpsVersion: "cadops.v1",
      status: "blocked",
      diagnostics: []
    };
    const executeQuery = vi.fn(() => response);

    expect(querySketchCurveEditReadiness(executeQuery, proposal)).toBe(
      response
    );
    expect(executeQuery).toHaveBeenCalledWith({
      version: "cadops.v1",
      query: { query: "sketch.curveEditReadiness", proposal }
    });
  });

  it("submits the exact query-prepared operation alone without rebuilding it", async () => {
    const operation: PreparedSketchCurveEditOp = {
      op: "sketch.trim",
      sketchId: "sketch-a",
      precondition: {
        expectedSourceRevision: SOURCE_REVISION,
        expectedSolverEvaluationIdentity: "none"
      },
      entityId: "line-a",
      boundaryEntityIds: ["line-boundary"],
      pickPoint: [2, 0],
      createdEntityIds: ["line-created"],
      deleteConstraintIds: ["constraint-invalid"],
      deleteDimensionIds: ["dimension-invalid"]
    };
    const submit = vi.fn(async (operations: readonly CadOp[]) => {
      void operations;
      return { ok: true as const };
    });

    await expect(
      submitPreparedSketchCurveEdit(operation, submit)
    ).resolves.toEqual({ ok: true });
    const submitted = submit.mock.calls[0]?.[0];
    expect(submitted).toHaveLength(1);
    expect(submitted?.[0]).toBe(operation);
  });
});
