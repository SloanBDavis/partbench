import type {
  CadOp,
  CadQueryRequest,
  CadQueryResponse,
  PreparedSketchCurveEditOp,
  SketchCurveEditProposal,
  SketchCurveEditReadinessQueryResponse
} from "@web-cad/cad-protocol";

export type SketchCurveEditQueryExecutor = (
  request: CadQueryRequest
) => CadQueryResponse;

export function querySketchCurveEditReadiness(
  executeQuery: SketchCurveEditQueryExecutor,
  proposal: SketchCurveEditProposal
): SketchCurveEditReadinessQueryResponse {
  const response = executeQuery({
    version: "cadops.v1",
    query: { query: "sketch.curveEditReadiness", proposal }
  });
  if (response.ok && response.query === "sketch.curveEditReadiness") {
    return response;
  }
  return {
    ok: true,
    query: "sketch.curveEditReadiness",
    cadOpsVersion: "cadops.v1",
    status: "blocked",
    diagnostics: [
      {
        code: "SKETCH_EDIT_INVALID_PROPOSAL",
        severity: "blocker",
        message: "The curve-edit preview could not be evaluated.",
        sketchId: proposal.sketchId,
        recoveryAction: "Review the edit choices and refresh the preview."
      }
    ]
  };
}

export async function submitPreparedSketchCurveEdit<TResult>(
  operation: PreparedSketchCurveEditOp,
  submit: (operations: readonly CadOp[]) => Promise<TResult>
): Promise<TResult> {
  return submit([operation]);
}
