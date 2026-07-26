import { describe, expect, it } from "vitest";
import * as cadCore from "../packages/cad-core/src/index.ts";
import {
  formatV19CurveEditWorkflowSummary,
  runV19CurveEditWorkflow,
  V19_CURVE_EDIT_WORKFLOW_VERSION
} from "./v19-curve-edit-workflow.mjs";

describe("V19 Slice B curve-edit workflow smoke", () => {
  it("proves the deterministic command, consequence, history, and round-trip workflow", () => {
    const first = runV19CurveEditWorkflow(cadCore);
    const second = runV19CurveEditWorkflow(cadCore);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      version: V19_CURVE_EDIT_WORKFLOW_VERSION,
      ok: true,
      checkCount: 10,
      passedCount: 10,
      failures: [],
      summary: {
        sketchId: "sketch_1",
        deletedDimensionIds: ["trim_length"],
        transactionCount: 3,
        schemaVersion: cadCore.CAD_PROJECT_FORMAT_VERSION_V22
      }
    });
    expect(first.checks.map((check) => check.id)).toEqual([
      "readiness",
      "constrained-trim-consequence",
      "incomplete-delete-list-rejected-with-impact",
      "explicit-commit",
      "replacement-evidence",
      "materialized-history",
      "finite-boundary-extend",
      "single-step-undo-redo",
      "source-identity",
      "json-round-trip"
    ]);
    expect(formatV19CurveEditWorkflowSummary(first)).toContain(
      "V19 curve-edit workflow smoke passed: 10/10 checks passed."
    );
  });
});
